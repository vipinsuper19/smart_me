package com.smartme.app.di

import com.smartme.app.BuildConfig
import com.smartme.app.core.connectivity.ConnectivityNetworkMonitor
import com.smartme.app.core.connectivity.NetworkMonitor
import com.smartme.app.core.network.ApiErrorMapper
import com.smartme.app.core.network.AuthApi
import com.smartme.app.core.network.AuthInterceptor
import com.smartme.app.core.network.SmartMeApi
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

private const val AUTH_CLIENT = "auth-client"
private const val AUTH_RETROFIT = "auth-retrofit"
private const val JSON_MEDIA_TYPE = "application/json"

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    @Provides
    @Singleton
    fun provideErrorMapper(json: Json): ApiErrorMapper = ApiErrorMapper(json)

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient =
        baseClientBuilder()
            .addInterceptor(authInterceptor)
            .build()

    /**
     * Client for the anonymous auth routes. It has no [AuthInterceptor] so a
     * rejected refresh token cannot start another refresh.
     */
    @Provides
    @Singleton
    @Named(AUTH_CLIENT)
    fun provideAuthOkHttpClient(): OkHttpClient = baseClientBuilder().build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit =
        retrofit(client, json)

    @Provides
    @Singleton
    @Named(AUTH_RETROFIT)
    fun provideAuthRetrofit(@Named(AUTH_CLIENT) client: OkHttpClient, json: Json): Retrofit =
        retrofit(client, json)

    @Provides
    @Singleton
    fun provideSmartMeApi(retrofit: Retrofit): SmartMeApi =
        retrofit.create(SmartMeApi::class.java)

    @Provides
    @Singleton
    fun provideAuthApi(@Named(AUTH_RETROFIT) retrofit: Retrofit): AuthApi =
        retrofit.create(AuthApi::class.java)

    private fun retrofit(client: OkHttpClient, json: Json): Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(client)
        .addConverterFactory(json.asConverterFactory(JSON_MEDIA_TYPE.toMediaType()))
        .build()

    private fun baseClientBuilder(): OkHttpClient.Builder {
        val builder = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .callTimeout(30, TimeUnit.SECONDS)

        // BASIC logs never include bodies, so credentials cannot reach logcat.
        if (BuildConfig.DEBUG) {
            builder.addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                    redactHeader(AuthInterceptor.HEADER)
                },
            )
        }
        return builder
    }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class ConnectivityModule {

    @Binds
    @Singleton
    abstract fun bindNetworkMonitor(impl: ConnectivityNetworkMonitor): NetworkMonitor
}
