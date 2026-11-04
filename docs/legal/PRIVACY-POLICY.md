# SmartMe Privacy Policy (Draft)

> **Draft for legal review — not legal advice.** Replace every bracketed
> placeholder, confirm the retention periods against actual operations, and have
> qualified Indian counsel review this policy before publication. The effective
> date and version must match `TERMS_VERSION` in the backend configuration.

**Effective date:** [EFFECTIVE DATE]  
**Version:** [POLICY VERSION]  
**Data fiduciary:** [LEGAL ENTITY NAME]  
**Registered address:** [REGISTERED ADDRESS]  
**Contact:** [PRIVACY EMAIL]  
**Grievance officer:** [NAME], [GRIEVANCE EMAIL], [PHONE]

SmartMe is an Android microlearning application for adults in India. This policy
explains what personal data we collect, why we collect it, how long we keep it
and the choices you have. It applies to the SmartMe Android app, the admin panel
and the SmartMe API.

---

## 1. Summary

- We collect the account details you give us, the learning activity needed to run
  the service, and the purchase information needed to provide Premium.
- We use this data to sign you in, personalise lessons, save progress, provide
  subscriptions, send reminders you ask for and keep the service secure.
- We do not sell your personal data.
- You can edit your profile, change preferences and request account deletion in
  the app.
- Some features use Google services (Google Sign-In, Google Play Billing and,
  when enabled, Firebase Cloud Messaging). Their handling of data is governed by
  their own policies.

---

## 2. Data we collect

### 2.1 Account and profile data

| Data | Why | Required |
|---|---|---|
| Name | Account identity, greetings, admin support | Yes for email registration |
| Email address | Sign-in, account communication, support | Yes for email registration |
| Password hash | Sign-in | Yes for email registration; never stored in plain text |
| Google account identifier and email | Google Sign-In | Only if you choose Google Sign-In |
| Avatar URL, headline, occupation, city, bio | Optional profile | No |
| Date of birth | Age suitability and profile | No |
| Learning goal, proficiency, explanation language, daily target, interests | Personalisation | Yes for onboarding; editable |
| Consent version and timestamp | Evidence of accepted terms | Yes |

### 2.2 Learning and usage data

- Lessons started, progress percentage, completion status and timestamps.
- Quiz attempts, answers, scores, explanations viewed and XP awards.
- XP, level, streaks, daily goals and achievements.
- Reminder preferences and notification delivery status.
- Product events such as screen views and feature usage, with personal
  identifiers removed before storage.
- App diagnostics needed to fix errors, such as API error codes and request IDs.

### 2.3 Subscription and purchase data

- Plan selected, subscription status, entitlement start/end and grace period.
- Google Play purchase token, order identifier and verification result.
- We do not receive or store your full card number, UPI ID or bank credentials.
  Google Play processes the payment.

### 2.4 Device and notification data

- A Firebase Cloud Messaging token when you enable notifications.
- Device model, app version and platform needed to deliver notifications and
  diagnose compatibility problems.
- Notification delivery attempts and invalid-token status.

### 2.5 Server and security logs

- Request method, path, status code, duration, timestamp, request ID and error
  code.
- We deliberately drop query strings from access logs so search terms are not
  stored by default.
- Our hosting or proxy provider may process IP addresses and standard server
  metadata for security and abuse prevention.

---

## 3. How we use data

We use personal data to:

1. Create and secure your account, authenticate sessions and prevent abuse.
2. Deliver onboarding, recommendations, lessons, quizzes and progress tracking.
3. Maintain streaks, XP, achievements and daily goals.
4. Verify and manage Premium subscriptions and restore purchases.
5. Send reminders and announcements you have enabled.
6. Provide support and respond to requests.
7. Monitor reliability, debug errors and improve the product.
8. Meet legal, tax, accounting and security obligations.
9. Produce aggregated statistics that do not identify you.

We do not use your data for automated decisions that produce legal or similarly
significant effects. We do not sell personal data or use it for third-party
behavioural advertising.

---

## 4. Legal bases

Where required, we rely on:

- **Contract:** to provide the account, learning service and subscription you
  requested.
- **Consent:** for optional notifications, Google Sign-In and any optional
  marketing. You can withdraw consent at any time.
- **Legitimate interests:** to secure the service, prevent fraud, debug errors
  and improve the product, balanced against your rights.
- **Legal obligation:** to keep records required by tax, accounting or law.

---

## 5. Sharing

We share data only as needed:

| Recipient | Purpose | Data |
|---|---|---|
| Google Play Billing | Process purchases, verify subscriptions, restore purchases | Purchase token, order ID, subscription status |
| Google Sign-In | Authenticate your Google account | Google ID token, email, name and avatar |
| Firebase Cloud Messaging | Deliver notifications you enabled | Device token, notification payload |
| Hosting, database and log providers | Run the service securely | Account and usage data as a processor |
| Professional advisers and authorities | Legal, tax, fraud or safety obligations | Only what is required by law |

Processors act on our instructions and are bound by confidentiality and security
obligations. Some providers may process data outside India. Where that happens,
we use appropriate contractual and security safeguards and comply with applicable
cross-border transfer requirements.

We may disclose data if required by law, to protect users or the public, to
investigate fraud, or as part of a merger, acquisition or restructuring with
appropriate confidentiality protections.

---

## 6. Retention and deletion

| Data | Retention |
|---|---|
| Account and profile | Until you delete your account or the account is inactive for [INACTIVITY PERIOD] |
| Learning activity and progress | Until account deletion, then deleted or aggregated |
| Notification tokens | Until you disable notifications, uninstall, or the token becomes invalid |
| Subscription and transaction records | For the period required by tax, accounting and consumer-protection law |
| Security and access logs | [30–90] days, unless needed for an investigation |
| Aggregated analytics | Retained without personal identifiers |

When you request deletion:

1. The request is recorded and your active sessions are revoked immediately.
2. You may cancel during the grace period, which is currently
   `ACCOUNT_DELETION_GRACE_DAYS` (default 30 days).
3. After the grace period, personal data is deleted or irreversibly anonymised,
   except records we must keep by law.
4. Backup copies are removed on the backup rotation cycle. We do not restore
   deleted accounts from backup except to recover from a service-wide failure.

You can request deletion in the app under **Profile → Privacy → Delete account**,
or through [PUBLIC DELETION URL]. You may also contact [PRIVACY EMAIL]; we may
need to verify your identity before acting.

---

## 7. Security

We use:

- TLS for data in transit.
- Argon2id password hashing.
- Short-lived access tokens and rotating refresh tokens.
- Android Keystore-backed encrypted token storage.
- Role-based access control for administrators.
- Rate limiting, request validation and a standard error envelope that does not
  expose internals.
- Request IDs and security logging for investigation.

No system is perfectly secure. If you believe your account is compromised,
contact [SECURITY EMAIL] immediately.

---

## 8. Your rights

Subject to applicable law, you may:

- Access the personal data we hold about you.
- Correct inaccurate profile or account data.
- Withdraw consent for optional processing.
- Request deletion of your account and data.
- Request a copy of your data in a portable format.
- Object to or restrict certain processing.
- Lodge a complaint with the Data Protection Board of India or another competent
  authority.

Use the in-app controls where available, or contact [PRIVACY EMAIL]. We respond
within the period required by law. We may need to verify your identity. There is
no fee for a normal request.

---

## 9. Children and age

SmartMe is intended for adults aged 18 and over. We do not knowingly collect
personal data from children. If you believe a child has created an account,
contact [PRIVACY EMAIL] and we will investigate and delete the account where
appropriate. If we later introduce services for minors, we will update this
policy and obtain any required parental consent before doing so.

---

## 10. Notifications

You control reminders in **Profile → Notifications**. You can disable individual
reminders or all notifications, and you can revoke the Android notification
permission in system settings. Disabling notifications does not stop essential
account or security messages.

---

## 11. Cookies and local storage

The Android app uses encrypted local storage for session tokens and local
preferences; it does not use advertising cookies. The admin panel uses browser
storage for the admin session and may use strictly necessary cookies from the
hosting platform. We do not use third-party advertising cookies.

---

## 12. Third-party links and services

The app may link to Google Play subscription management, Google Sign-In or
support email. Those services have their own privacy policies. We are not
responsible for their practices, but we choose providers with appropriate
security and data-protection commitments.

---

## 13. Changes to this policy

We may update this policy to reflect product, legal or operational changes. We
will publish the new version, update the effective date and, for material
changes, notify you in the app or by email before the change takes effect. Where
required, we will ask for fresh consent.

---

## 14. Contact and grievances

- **Privacy questions:** [PRIVACY EMAIL]
- **Support:** support@smartme.app
- **Security reports:** [SECURITY EMAIL]
- **Grievance officer:** [NAME], [GRIEVANCE EMAIL], [ADDRESS], [PHONE]
- **Data fiduciary:** [LEGAL ENTITY NAME], [REGISTERED ADDRESS]

If you are not satisfied with our response, you may contact the Data Protection
Board of India or the consumer forum with jurisdiction over your matter.
