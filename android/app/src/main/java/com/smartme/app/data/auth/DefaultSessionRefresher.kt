package com.smartme.app.data.auth

import com.smartme.app.core.network.AuthApi
import com.smartme.app.core.network.RefreshRequest
import com.smartme.app.core.network.SessionRefresher
import com.smartme.app.core.security.TokenStore
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.cancellation.CancellationException

/**
 * Single-flight refresh used by [com.smartme.app.core.network.AuthInterceptor].
 *
 * A mutex serialises refreshes. Requests that queued behind a successful refresh
 * see the replacement access token in the store and reuse it instead of rotating
 * again, which matters because the backend rotates refresh tokens on every call.
 */
@Singleton
class DefaultSessionRefresher @Inject constructor(
    private val authApi: AuthApi,
    private val tokenStore: TokenStore,
) : SessionRefresher {

    private val refreshMutex = Mutex()

    override fun refreshBlocking(failedAccessToken: String): String? = runBlocking {
        refreshMutex.withLock {
            val session = tokenStore.session.value ?: return@withLock null
            if (!session.isRefreshTokenValid(System.currentTimeMillis())) {
                tokenStore.clear()
                return@withLock null
            }

            // Another request may have refreshed while this one waited for the lock.
            val currentAccessToken = tokenStore.accessTokenOrNull()
            if (currentAccessToken != null && currentAccessToken != failedAccessToken) {
                return@withLock currentAccessToken
            }

            try {
                val tokens = authApi.refresh(RefreshRequest(session.refreshToken)).tokens.toSessionTokens()
                tokenStore.save(tokens)
                tokens.accessToken
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (http: HttpException) {
                // A rejected refresh token means the session is gone for good.
                if (http.code() == 401 || http.code() == 403) {
                    tokenStore.clear()
                }
                null
            } catch (network: IOException) {
                // Keep the session: the next request may still succeed online.
                null
            } catch (unexpected: Exception) {
                null
            }
        }
    }
}
