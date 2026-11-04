package com.smartme.app.feature.support

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.annotation.StringRes
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.ReportProblem
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import com.smartme.app.R
import com.smartme.app.core.designsystem.theme.SmartMeTheme
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.feature.learning.LearningTopBar

private const val SupportEmail = "support@smartme.app"

private data class FaqItem(
    @param:StringRes val question: Int,
    @param:StringRes val answer: Int,
)

private val SupportFaqs = listOf(
    FaqItem(R.string.support_faq_offline_q, R.string.support_faq_offline_a),
    FaqItem(R.string.support_faq_progress_q, R.string.support_faq_progress_a),
    FaqItem(R.string.support_faq_premium_q, R.string.support_faq_premium_a),
    FaqItem(R.string.support_faq_cancel_q, R.string.support_faq_cancel_a),
    FaqItem(R.string.support_faq_restore_q, R.string.support_faq_restore_a),
    FaqItem(R.string.support_faq_delete_q, R.string.support_faq_delete_a),
    FaqItem(R.string.support_faq_notifications_q, R.string.support_faq_notifications_a),
)

/**
 * Static help content: there is no support backend in the MVP, so the screen
 * pairs honest FAQs with a direct email route and never pretends to submit a
 * ticket.
 */
@Composable
fun SupportScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val noEmailAppMessage = stringResource(R.string.support_no_email_app)

    fun sendEmail(subject: String) {
        val intent = Intent(
            Intent.ACTION_SENDTO,
            "mailto:$SupportEmail?subject=${Uri.encode(subject)}".toUri(),
        )
        val opened = runCatching { context.startActivity(intent) }.isSuccess
        if (!opened) {
            Toast.makeText(context, noEmailAppMessage, Toast.LENGTH_LONG).show()
        }
    }

    Column(modifier = modifier.fillMaxSize()) {
        val supportSubject = stringResource(R.string.support_email_subject)
        val reportSubject = stringResource(R.string.support_report_subject)
        LearningTopBar(
            title = stringResource(R.string.support_title),
            onBack = onBack,
        )
        SupportContent(
            onEmailSupport = { sendEmail(supportSubject) },
            onReportProblem = { sendEmail(reportSubject) },
        )
    }
}

@Composable
internal fun SupportContent(
    onEmailSupport: () -> Unit,
    onReportProblem: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var expandedFaq by remember { mutableStateOf<Int?>(null) }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.sm,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            ) {
                Column(
                    modifier = Modifier.padding(Spacing.lg),
                    verticalArrangement = Arrangement.spacedBy(Spacing.sm),
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.HelpOutline,
                        contentDescription = null,
                        modifier = Modifier.size(30.dp),
                    )
                    Text(
                        text = stringResource(R.string.support_intro_title),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(R.string.support_intro_body),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }

        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.surface,
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    MaterialTheme.colorScheme.outlineVariant,
                ),
            ) {
                Column(
                    modifier = Modifier.padding(Spacing.lg),
                    verticalArrangement = Arrangement.spacedBy(Spacing.sm),
                ) {
                    Text(
                        text = stringResource(R.string.support_contact_title),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = stringResource(R.string.support_contact_body, SupportEmail),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(
                        onClick = onEmailSupport,
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Email,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = stringResource(R.string.support_email_action),
                            modifier = Modifier.padding(start = Spacing.sm),
                        )
                    }
                    OutlinedButton(
                        onClick = onReportProblem,
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.ReportProblem,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = stringResource(R.string.support_report_action),
                            modifier = Modifier.padding(start = Spacing.sm),
                        )
                    }
                    Text(
                        text = stringResource(R.string.support_response_note),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item {
            Text(
                text = stringResource(R.string.support_faq_title),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }

        items(SupportFaqs.size, key = { index -> index }) { index ->
            val faq = SupportFaqs[index]
            FaqRow(
                question = stringResource(faq.question),
                answer = stringResource(faq.answer),
                expanded = expandedFaq == index,
                onToggle = {
                    expandedFaq = if (expandedFaq == index) null else index
                },
            )
        }

        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                color = SmartMeTheme.colors.xpContainer,
                contentColor = SmartMeTheme.colors.onXpContainer,
            ) {
                Row(
                    modifier = Modifier.padding(Spacing.md),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = stringResource(R.string.support_privacy_hint),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun FaqRow(
    question: String,
    answer: String,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant,
        ),
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(Spacing.md),
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = question,
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Icon(
                    imageVector = if (expanded) {
                        Icons.Outlined.ExpandLess
                    } else {
                        Icons.Outlined.ExpandMore
                    },
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp),
                )
            }
            if (expanded) {
                Text(
                    text = answer,
                    modifier = Modifier.padding(
                        start = Spacing.md,
                        end = Spacing.md,
                        bottom = Spacing.md,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
