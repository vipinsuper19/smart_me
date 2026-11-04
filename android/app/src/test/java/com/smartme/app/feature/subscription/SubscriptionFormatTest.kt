package com.smartme.app.feature.subscription

import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SubscriptionFormatTest {

    @Test
    fun `INR prices use Indian digit grouping without unnecessary decimals`() {
        Locale.setDefault(Locale.US)
        val monthly = formatPriceInPaise(24900, "INR")
        val yearly = formatPriceInPaise(12345600, "INR")

        assertTrue(monthly.endsWith("249"))
        assertTrue(yearly.endsWith("1,23,456"))
        assertFalse(yearly.contains(".00"))
    }

    @Test
    fun `Indian grouping keeps the last three digits together`() {
        assertEquals("0", groupIndianDigits(0))
        assertEquals("999", groupIndianDigits(999))
        assertEquals("1,000", groupIndianDigits(1_000))
        assertEquals("12,345", groupIndianDigits(12_345))
        assertEquals("1,23,456", groupIndianDigits(123_456))
        assertEquals("12,34,56,789", groupIndianDigits(123_456_789))
    }

    @Test
    fun `part rupees keep two decimal places`() {
        Locale.setDefault(Locale.US)
        val price = formatPriceInPaise(24950, "INR")

        assertTrue(price.endsWith("249.50"))
    }

    @Test
    fun `unknown currency codes fall back without throwing`() {
        Locale.setDefault(Locale.US)
        val price = formatPriceInPaise(1000, "NOT-A-CURRENCY")

        assertTrue(price.contains("10"))
    }

    @Test
    fun `billing periods are recognised case insensitively`() {
        assertTrue(isYearly("YEARLY"))
        assertTrue(isYearly("annual"))
        assertFalse(isYearly("MONTHLY"))
        assertFalse(isYearly(""))
    }

    @Test
    fun `purchase result route values are normalised safely`() {
        assertEquals(PurchaseResultStatus.Success, purchaseResultStatus("success"))
        assertEquals(PurchaseResultStatus.Pending, purchaseResultStatus(" PENDING "))
        assertEquals(PurchaseResultStatus.Failure, purchaseResultStatus("failure"))
        assertEquals(PurchaseResultStatus.Failure, purchaseResultStatus(null))
        assertEquals(PurchaseResultStatus.Failure, purchaseResultStatus("granted"))
    }
}
