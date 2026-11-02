package com.smartme.app.di

import com.smartme.app.core.network.SessionRefresher
import com.smartme.app.data.auth.DefaultSessionRefresher
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class AuthModule {

    @Binds
    @Singleton
    abstract fun bindSessionRefresher(impl: DefaultSessionRefresher): SessionRefresher
}
