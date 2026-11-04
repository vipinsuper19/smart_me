package com.smartme.app.data.progress

import com.smartme.app.core.network.AchievementsDto
import com.smartme.app.core.network.ApiExecutor
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.ProgressOverviewDto
import com.smartme.app.core.network.SmartMeApi
import com.smartme.app.core.network.WeeklyProgressDto
import javax.inject.Inject
import javax.inject.Singleton

/** Progress dashboard reads and the achievement catalogue. */
@Singleton
class ProgressRepository @Inject constructor(
    private val api: SmartMeApi,
    private val apiExecutor: ApiExecutor,
) {

    suspend fun overview(): ApiResult<ProgressOverviewDto> = apiExecutor.call {
        api.progressOverview()
    }

    suspend fun weekly(): ApiResult<WeeklyProgressDto> = apiExecutor.call {
        api.weeklyProgress()
    }

    suspend fun achievements(): ApiResult<AchievementsDto> = apiExecutor.call {
        api.achievements()
    }
}
