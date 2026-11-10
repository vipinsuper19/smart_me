package com.smartme.app.feature.explore

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.CourseCardDto
import com.smartme.app.core.network.LearningPathDto
import com.smartme.app.core.network.ProgressSummaryDto
import com.smartme.app.feature.learning.LearningSamples

private val roadmapCourse: CourseCardDto = LearningSamples.course

private val roadmapPath: LearningPathDto = LearningSamples.path.copy(
    title = "English Communication",
    description = "Build real-world English skills step by step.",
    courseCount = 4,
    lessonCount = 12,
    progress = ProgressSummaryDto(
        totalLessons = 12,
        startedLessons = 6,
        completedLessons = 5,
        percent = 35,
    ),
    courses = listOf(
        roadmapCourse.copy(
            id = "course-getting-started",
            title = "Getting Started with English",
            shortDescription = "Basic words, greetings and introductions.",
            lessonCount = 3,
            estimatedMinutes = 15,
            progress = ProgressSummaryDto(
                totalLessons = 3,
                completedLessons = 3,
                percent = 100,
            ),
        ),
        roadmapCourse.copy(
            id = "course-everyday-conversations",
            title = "Everyday Conversations",
            shortDescription = "Common situations and useful phrases.",
            lessonCount = 3,
            estimatedMinutes = 15,
            progress = ProgressSummaryDto(
                totalLessons = 3,
                completedLessons = 3,
                percent = 100,
            ),
        ),
        roadmapCourse.copy(
            id = "course-vocabulary",
            title = "Vocabulary for Daily Life",
            shortDescription = "Build practical vocabulary for real situations.",
            lessonCount = 4,
            estimatedMinutes = 20,
            progress = ProgressSummaryDto(
                totalLessons = 4,
                startedLessons = 4,
                completedLessons = 2,
                percent = 40,
            ),
        ),
        roadmapCourse.copy(
            id = "course-grammar",
            title = "Grammar in Real Use",
            shortDescription = "Simple grammar for better communication.",
            lessonCount = 2,
            estimatedMinutes = 10,
            locked = true,
            progress = ProgressSummaryDto(totalLessons = 2),
        ),
    ),
)

@ScreenPreviews
@Composable
private fun PathDetailPreview() {
    PreviewContainer {
        PathDetailContent(
            state = UiState.Content(roadmapPath),
            onBack = {},
            onRetry = {},
            onOpenCourse = {},
            onOpenAchievements = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PathDetailAllLockedPreview() {
    PreviewContainer {
        PathDetailContent(
            state = UiState.Content(
                roadmapPath.copy(
                    progress = ProgressSummaryDto(),
                    courses = roadmapPath.courses.map { course ->
                        course.copy(locked = true)
                    },
                ),
            ),
            onBack = {},
            onRetry = {},
            onOpenCourse = {},
            onOpenAchievements = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PathDetailLoadingPreview() {
    PreviewContainer {
        PathDetailContent(
            state = UiState.Loading,
            onBack = {},
            onRetry = {},
            onOpenCourse = {},
            onOpenAchievements = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PathDetailErrorPreview() {
    PreviewContainer {
        PathDetailContent(
            state = UiState.Error(
                message = "We couldn't reach SmartMe. Check your connection and try again.",
            ),
            onBack = {},
            onRetry = {},
            onOpenCourse = {},
            onOpenAchievements = {},
        )
    }
}
