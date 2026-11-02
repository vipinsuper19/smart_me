package com.smartme.app.core.network

import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.cancellation.CancellationException

/**
 * Runs a suspend API call and converts every failure mode into an [ApiResult].
 * Feature code never sees Retrofit or OkHttp exceptions.
 */
@Singleton
class ApiExecutor @Inject constructor(private val errorMapper: ApiErrorMapper) {

    suspend fun <T> call(block: suspend () -> T): ApiResult<T> = try {
        ApiResult.Success(block())
    } catch (cancellation: CancellationException) {
        throw cancellation
    } catch (http: HttpException) {
        ApiResult.Failure(errorMapper.fromHttpStatus(http.code(), http.errorBodyOrNull()))
    } catch (io: IOException) {
        ApiResult.Failure(errorMapper.fromTransportFailure(io))
    } catch (unexpected: Exception) {
        ApiResult.Failure(errorMapper.fromUnexpectedFailure(unexpected))
    }

    private fun HttpException.errorBodyOrNull(): String? =
        runCatching { response()?.errorBody()?.string() }.getOrNull()
}
