package com.smartme.app.di

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.smartme.app.core.security.DataStoreTokenPersistence
import com.smartme.app.core.security.KeystoreTokenCipher
import com.smartme.app.core.security.TokenCipher
import com.smartme.app.core.security.TokenPersistence
import com.smartme.app.core.security.TokenStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SecurityModule {

    @Provides
    @Singleton
    fun provideTokenCipher(): TokenCipher = KeystoreTokenCipher()

    @Provides
    @Singleton
    fun provideTokenPersistence(
        @Named(DataStoreNames.TOKENS) dataStore: DataStore<Preferences>,
    ): TokenPersistence = DataStoreTokenPersistence(dataStore)

    @Provides
    @Singleton
    fun provideTokenStore(
        persistence: TokenPersistence,
        cipher: TokenCipher,
        json: Json,
    ): TokenStore = TokenStore(
        persistence = persistence,
        cipher = cipher,
        json = json,
    )
}
