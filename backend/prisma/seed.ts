/**
 * Development seed.
 *
 * Creates:
 * - a super-admin account
 * - a demo learner with onboarding preferences
 * - subscription plans and achievement definitions
 * - three published learning paths with four courses and eight playable lessons
 * - quizzes with explanations, plus today's daily challenge
 *
 * Safe to re-run: every record is upserted by a natural key. Lesson blocks and
 * quiz questions are recreated for the seeded lessons.
 *
 * Do not run in production with demo content enabled.
 */
import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import {
  AccessTier,
  AdminRole,
  BillingPeriod,
  ContentBlockType,
  ContentLanguage,
  LearningGoal,
  ProficiencyLevel,
  PublicationStatus,
  QuestionType,
  QuizKind,
} from '../src/generated/prisma/enums';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 }),
});

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@smartme.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
const LEARNER_EMAIL = process.env.SEED_LEARNER_EMAIL ?? 'learner@smartme.local';
const LEARNER_PASSWORD = process.env.SEED_LEARNER_PASSWORD ?? 'Learner@12345';
const TIME_ZONE = process.env.APP_TIME_ZONE ?? 'Asia/Kolkata';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
  throw new Error(
    'Refusing to seed production. Set ALLOW_PRODUCTION_SEED=true if you are certain.',
  );
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

type SeedBlock = { type: ContentBlockType; payload: Prisma.InputJsonValue };

const heading = (text: string): SeedBlock => ({
  type: ContentBlockType.HEADING,
  payload: { text },
});

const paragraph = (text: string): SeedBlock => ({
  type: ContentBlockType.PARAGRAPH,
  payload: { text },
});

const bulletList = (items: string[]): SeedBlock => ({
  type: ContentBlockType.BULLET_LIST,
  payload: { items },
});

const callout = (
  title: string,
  text: string,
  language: ContentLanguage = ContentLanguage.ENGLISH,
): SeedBlock => ({
  type: ContentBlockType.CALLOUT,
  payload: { title, text, language },
});

const conversation = (lines: { speaker: string; text: string }[]): SeedBlock => ({
  type: ContentBlockType.EXAMPLE_CONVERSATION,
  payload: { lines },
});

const recap = (items: string[]): SeedBlock => ({
  type: ContentBlockType.RECAP,
  payload: { items },
});

type SeedOption = { text: string; isCorrect?: boolean; feedback?: string };

type SeedQuestion = {
  type: QuestionType;
  prompt: string;
  scenario?: string;
  explanation: string;
  options: SeedOption[];
};

type SeedQuiz = {
  slug: string;
  title: string;
  description?: string;
  kind?: QuizKind;
  xpReward?: number;
  questions: SeedQuestion[];
};

type SeedLesson = {
  slug: string;
  title: string;
  summary: string;
  objective: string;
  estimatedMinutes: number;
  accessTier: AccessTier;
  difficulty?: ProficiencyLevel;
  requiresQuiz?: boolean;
  blocks: SeedBlock[];
  quiz?: SeedQuiz;
};

type SeedModule = {
  slug: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  lessons: SeedLesson[];
};

type SeedCourse = {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  objectives: string[];
  difficulty: ProficiencyLevel;
  estimatedMinutes: number;
  accessTier: AccessTier;
  modules: SeedModule[];
};

type SeedPath = {
  slug: string;
  title: string;
  description: string;
  courses: SeedCourse[];
};

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------

const curriculum: SeedPath[] = [
  {
    slug: 'english-communication',
    title: 'English Communication',
    description:
      'Speak clearly and confidently at work, in interviews and in everyday conversations.',
    courses: [
      {
        slug: 'everyday-english-foundations',
        title: 'Everyday English Foundations',
        shortDescription: 'Build a confident introduction and keep conversations moving.',
        description:
          'A practical starting point for learners who understand English but freeze when they have to speak. Short lessons, simple structures and realistic Indian examples.',
        objectives: [
          'Introduce yourself in under 60 seconds',
          'Use a clear four-part structure',
          'Start and continue a simple conversation',
        ],
        difficulty: ProficiencyLevel.BEGINNER,
        estimatedMinutes: 25,
        accessTier: AccessTier.FREE,
        modules: [
          {
            slug: 'introducing-yourself',
            title: 'Introducing Yourself',
            description: 'Build a short, useful answer to “Tell me about yourself”.',
            estimatedMinutes: 15,
            lessons: [
              {
                slug: 'tell-me-about-yourself',
                title: 'Tell Me About Yourself',
                summary:
                  'A four-part structure that works in interviews and networking conversations.',
                objective: 'Deliver a clear 60-second introduction with one relevant proof point.',
                estimatedMinutes: 6,
                accessTier: AccessTier.FREE,
                requiresQuiz: true,
                blocks: [
                  heading('A 60-second introduction that works'),
                  paragraph(
                    'Most people either recite their CV or share their life story. Interviewers want a short answer that connects who you are today to the role in front of you.',
                  ),
                  bulletList([
                    'Present — who you are and what you do now',
                    'Proof — one skill or achievement that supports it',
                    'Future — why this role or conversation makes sense',
                    'Close — leave a natural follow-up question',
                  ]),
                  callout(
                    'Present → Proof → Future',
                    'Keep the answer under 60 seconds. Practise out loud until it sounds like a conversation, not a speech.',
                  ),
                  conversation([
                    {
                      speaker: 'Interviewer',
                      text: 'Tell me about yourself.',
                    },
                    {
                      speaker: 'Candidate',
                      text: "I'm a final-year B.Com student from Jaipur. For the last year I've handled customer support for a small online store, which taught me to explain problems clearly and stay calm when someone is upset. I'm now looking for a customer-facing role where I can use that skill every day.",
                    },
                    {
                      speaker: 'Interviewer',
                      text: 'What kind of issues did you handle?',
                    },
                  ]),
                  paragraph(
                    'Notice that the answer invites a follow-up question. That is a good sign — you have given the interviewer something useful to ask about.',
                  ),
                  callout(
                    'Hinglish tip',
                    'Perfect English zaroori nahi hai. Simple, clear aur honest answer zyada effective hota hai.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap([
                    'Start with the present, not your childhood',
                    'Add one proof point',
                    'Link it to the role',
                    'Stop before 60 seconds',
                  ]),
                ],
                quiz: {
                  slug: 'quiz-tell-me-about-yourself',
                  title: 'Check your introduction',
                  description: 'Three quick questions on structure and relevance.',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SCENARIO,
                      prompt:
                        'An interviewer says, “Tell me about yourself.” Which opening is strongest?',
                      explanation:
                        'The strongest opening states who you are now and offers a relevant strength. It gives the interviewer a reason to keep listening.',
                      options: [
                        {
                          text: 'I was born in Patna and studied there until class 12.',
                          feedback: 'This is history, not a professional introduction.',
                        },
                        {
                          text: "I'm a final-year commerce student who enjoys turning messy data into clear reports.",
                          isCorrect: true,
                        },
                        {
                          text: 'Everything is already in my resume.',
                          feedback: 'This closes the conversation instead of opening it.',
                        },
                        {
                          text: "I'm not sure where to begin.",
                          feedback: 'Preparation shows. This answer signals the opposite.',
                        },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt: 'A strong introduction should cover your entire life history.',
                      explanation:
                        'An introduction should be short and relevant. The interviewer can ask for details later.',
                      options: [{ text: 'True' }, { text: 'False', isCorrect: true }],
                    },
                    {
                      type: QuestionType.SINGLE_CHOICE,
                      prompt: 'Which detail makes a 60-second introduction stronger?',
                      explanation:
                        'A skill that matches the role helps the interviewer picture you doing the job.',
                      options: [
                        { text: 'Your favourite film' },
                        { text: 'A skill that matches the job', isCorrect: true },
                        { text: 'Your marks in class 5' },
                        { text: "Your neighbour's job" },
                      ],
                    },
                  ],
                },
              },
              {
                slug: 'first-impressions',
                title: 'First Impressions That Stick',
                summary: 'Small habits that make you look prepared before the first question.',
                objective: 'Prepare your arrival, greeting and first sentence for an interview.',
                estimatedMinutes: 4,
                accessTier: AccessTier.FREE,
                blocks: [
                  heading('First impressions start before you speak'),
                  paragraph(
                    'In an interview or a meeting, the first 30 seconds are about presence: arriving on time, greeting people clearly and looking ready.',
                  ),
                  bulletList([
                    'Join the call 2–3 minutes early',
                    'Greet with a clear “Good morning” or “Good afternoon”',
                    'Keep your phone away and your notes nearby',
                    'Sit upright and take one slow breath before you start',
                  ]),
                  callout(
                    'Small habit',
                    'Say your first sentence slowly. Nervousness makes most people speed up.',
                  ),
                  recap(['Be early', 'Greet clearly', 'Slow your first sentence']),
                ],
              },
            ],
          },
          {
            slug: 'small-talk',
            title: 'Small Talk Without Fear',
            description: 'Turn awkward silences into short, friendly exchanges.',
            estimatedMinutes: 8,
            lessons: [
              {
                slug: 'starting-conversations',
                title: 'Starting Conversations',
                summary: 'A simple four-step pattern for opening a conversation.',
                objective: 'Start a low-pressure conversation and ask one follow-up question.',
                estimatedMinutes: 5,
                accessTier: AccessTier.FREE,
                blocks: [
                  heading('Small talk is a bridge, not a performance'),
                  paragraph(
                    'You do not need a clever line. You need a simple observation and one genuine question.',
                  ),
                  bulletList([
                    'Comment on something you both share',
                    'Ask an open question that cannot be answered in one word',
                    'Share one small detail about yourself',
                    'Listen for something you can follow up on',
                  ]),
                  conversation([
                    { speaker: 'You', text: 'That was a long meeting, wasn’t it?' },
                    {
                      speaker: 'Colleague',
                      text: 'Very long. I thought the budget discussion would never end.',
                    },
                    {
                      speaker: 'You',
                      text: 'Same here. Which part are you working on now?',
                    },
                  ]),
                  callout(
                    'Hinglish tip',
                    'Perfect English nahi chahiye — simple aur clear kaafi hai.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['Observe', 'Ask', 'Share', 'Listen']),
                ],
              },
            ],
          },
        ],
      },
      {
        slug: 'workplace-english',
        title: 'Workplace English',
        shortDescription: 'Write clearer emails and sound professional without sounding formal.',
        description:
          'Practical workplace writing and speaking for early-career professionals. Every lesson is a small, reusable habit.',
        objectives: ['Write an email with one clear ask', 'Sound professional and human'],
        difficulty: ProficiencyLevel.INTERMEDIATE,
        estimatedMinutes: 10,
        accessTier: AccessTier.PREMIUM,
        modules: [
          {
            slug: 'emails-and-meetings',
            title: 'Emails and Meetings',
            description: 'Say more with fewer words.',
            estimatedMinutes: 10,
            lessons: [
              {
                slug: 'writing-a-clear-email',
                title: 'Writing a Clear Email',
                summary: 'One email, one ask, one clear next step.',
                objective: 'Write a short professional email that is easy to act on.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                difficulty: ProficiencyLevel.INTERMEDIATE,
                requiresQuiz: true,
                blocks: [
                  heading('One email, one ask'),
                  paragraph(
                    'Most workplace emails are hard to act on because they hide the request at the end of a long paragraph. Put the purpose first.',
                  ),
                  bulletList([
                    'Subject: action + topic',
                    'First line: why you are writing',
                    'Middle: only the context the reader needs',
                    'Last line: what you need and by when',
                  ]),
                  callout('Example subject', 'Leave request for 24–25 October'),
                  paragraph(
                    'Before: “I wanted to check whether it might be possible for me to perhaps take some leave next week…”',
                  ),
                  paragraph(
                    'After: “I’d like to request two days of leave on 24–25 October for a family commitment. I’ve handed over my current tasks to Priya and will be reachable on email for anything urgent.”',
                  ),
                  callout(
                    'Hinglish tip',
                    'Request ko pehle likhiye, explanation baad mein. Reader ko guess nahi karna padega.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['One ask', 'Clear subject', 'Request first', 'Specific dates']),
                ],
                quiz: {
                  slug: 'quiz-writing-a-clear-email',
                  title: 'Email clarity check',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SINGLE_CHOICE,
                      prompt: 'Which subject line is most useful?',
                      explanation:
                        'A useful subject states the action and topic, so the reader knows what the email is about before opening it.',
                      options: [
                        { text: 'Hi' },
                        { text: 'Important' },
                        { text: 'Leave request for 24–25 October', isCorrect: true },
                        { text: 'Quick question' },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt: 'Long paragraphs make an email easier to understand.',
                      explanation:
                        'Short paragraphs and bullets are easier to scan, especially on a phone.',
                      options: [{ text: 'True' }, { text: 'False', isCorrect: true }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'career-workplace-skills',
    title: 'Career and Workplace Skills',
    description:
      'Practical skills for interviews, workplace communication and early-career confidence.',
    courses: [
      {
        slug: 'interview-ready',
        title: 'Interview Ready',
        shortDescription: 'Prepare, practise and answer tough questions with a clear structure.',
        description:
          'A focused interview preparation course. Learn what to research, how to answer difficult questions and how to close an interview well.',
        objectives: [
          'Research a company in 30 minutes',
          'Answer behavioural questions with STAR',
          'Handle weakness and failure questions honestly',
        ],
        difficulty: ProficiencyLevel.INTERMEDIATE,
        estimatedMinutes: 12,
        accessTier: AccessTier.PREMIUM,
        modules: [
          {
            slug: 'before-the-interview',
            title: 'Before the Interview',
            description: 'Walk in knowing the company and the role.',
            estimatedMinutes: 5,
            lessons: [
              {
                slug: 'research-the-company',
                title: 'Research the Company',
                summary: 'The four things worth knowing before you walk in.',
                objective: 'Prepare three useful facts about a company and one question to ask.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                difficulty: ProficiencyLevel.INTERMEDIATE,
                blocks: [
                  heading('Walk in knowing three things'),
                  paragraph(
                    'You do not need to memorise the annual report. You need enough context to ask one intelligent question.',
                  ),
                  bulletList([
                    'What the company sells and to whom',
                    'One recent piece of news or product change',
                    'Why this role exists on the team',
                    'One thoughtful question for the interviewer',
                  ]),
                  callout(
                    'Where to look',
                    'Company website, recent news, the job description and the public profile of one team member.',
                  ),
                  recap(['Product', 'Customers', 'Recent news', 'Your question']),
                ],
              },
            ],
          },
          {
            slug: 'in-the-room',
            title: 'In the Room',
            description: 'Answer difficult questions without rambling or blaming others.',
            estimatedMinutes: 7,
            lessons: [
              {
                slug: 'answering-tough-questions',
                title: 'Answering Tough Questions',
                summary: 'Use STAR to turn a messy experience into a clear answer.',
                objective:
                  'Answer a behavioural question using Situation, Task, Action and Result.',
                estimatedMinutes: 7,
                accessTier: AccessTier.PREMIUM,
                difficulty: ProficiencyLevel.INTERMEDIATE,
                requiresQuiz: true,
                blocks: [
                  heading('Use STAR when the question gets hard'),
                  paragraph(
                    'Behavioural questions are asking for evidence, not opinions. A short story with a clear result is more convincing than a list of adjectives.',
                  ),
                  bulletList([
                    'Situation — set the scene in one line',
                    'Task — what you had to do',
                    'Action — what you actually did',
                    'Result — what changed, ideally with a number',
                  ]),
                  conversation([
                    { speaker: 'Interviewer', text: 'What is your biggest weakness?' },
                    {
                      speaker: 'Candidate',
                      text: 'I used to take on every task myself because I wanted things done quickly. During my internship I missed a deadline because of it. I started sharing a short daily priority list with my teammate, and we finished the next project two days early.',
                    },
                  ]),
                  callout(
                    'Hinglish tip',
                    'Weakness ko strength mat banao. Ek real weakness batao aur usse sudharne ka step batao.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['Situation', 'Task', 'Action', 'Result']),
                ],
                quiz: {
                  slug: 'quiz-answering-tough-questions',
                  title: 'STAR and tough questions',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SINGLE_CHOICE,
                      prompt: 'What does STAR stand for?',
                      explanation: 'STAR keeps an answer focused: Situation, Task, Action, Result.',
                      options: [
                        { text: 'Skill, Task, Attitude, Result' },
                        { text: 'Situation, Task, Action, Result', isCorrect: true },
                        { text: 'Story, Timing, Answer, Review' },
                        { text: 'Situation, Team, Action, Reflection' },
                      ],
                    },
                    {
                      type: QuestionType.SCENARIO,
                      prompt:
                        'What is the strongest way to answer “What is your biggest weakness?”',
                      explanation:
                        'A real weakness plus the concrete step you took is credible and shows self-awareness.',
                      options: [
                        { text: 'I have no weaknesses.', feedback: 'This is not credible.' },
                        {
                          text: 'I work too hard.',
                          feedback: 'Interviewers have heard this cliché many times.',
                        },
                        {
                          text: 'I used to take on every task myself; now I share priorities daily so deadlines are protected.',
                          isCorrect: true,
                        },
                        {
                          text: 'My previous manager was the problem.',
                          feedback: 'This blames someone else instead of showing ownership.',
                        },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt:
                        'It is a good idea to blame a previous employer when explaining a mistake.',
                      explanation:
                        'Interviewers look for ownership. Describe what you learned and what you changed.',
                      options: [{ text: 'True' }, { text: 'False', isCorrect: true }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'financial-literacy',
    title: 'Financial Literacy',
    description: 'Understand your money, build a budget and create a safety net.',
    courses: [
      {
        slug: 'money-basics',
        title: 'Money Basics',
        shortDescription: 'A simple budgeting system and your first emergency fund.',
        description:
          'A jargon-free introduction to managing a salary or allowance. These lessons are educational and do not provide personalised investment advice.',
        objectives: [
          'Split income into needs, wants and savings',
          'Start an emergency fund',
          'Review spending without guilt',
        ],
        difficulty: ProficiencyLevel.BEGINNER,
        estimatedMinutes: 12,
        accessTier: AccessTier.FREE,
        modules: [
          {
            slug: 'budgeting-and-saving',
            title: 'Budgeting and Saving',
            description: 'Give every rupee a job.',
            estimatedMinutes: 12,
            lessons: [
              {
                slug: 'the-50-30-20-rule',
                title: 'The 50-30-20 Rule',
                summary: 'A simple starting point for dividing your income.',
                objective: 'Create a monthly budget using the 50-30-20 split.',
                estimatedMinutes: 6,
                accessTier: AccessTier.FREE,
                requiresQuiz: true,
                blocks: [
                  heading('Give every rupee a job'),
                  paragraph(
                    'A budget is not a punishment. It is a plan that tells your money where to go before the month decides for you.',
                  ),
                  bulletList([
                    '50% needs — rent, food, transport, utilities',
                    '30% wants — dining out, subscriptions, shopping',
                    '20% savings and debt repayment',
                    'Adjust the split when your income is irregular',
                  ]),
                  callout(
                    'Start where you are',
                    'If saving 20% is impossible this month, start with 5% and increase it next month.',
                  ),
                  paragraph(
                    'The percentages are a starting point, not a rule. In a city with high rent, needs may take 60%. The important part is that savings has a line in the plan.',
                  ),
                  callout(
                    'Hinglish tip',
                    'Budget ka matlab restriction nahi hai. Har rupee ko ek direction dena hai.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['50 needs', '30 wants', '20 savings', 'Adjust to your reality']),
                ],
                quiz: {
                  slug: 'quiz-50-30-20',
                  title: 'Check your budget basics',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SINGLE_CHOICE,
                      prompt: 'In the 50-30-20 rule, what does the 50% cover?',
                      explanation:
                        'The 50% portion is for needs: essential expenses you cannot avoid.',
                      options: [
                        { text: 'Wants' },
                        { text: 'Needs', isCorrect: true },
                        { text: 'Savings' },
                        { text: 'Investments' },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt: 'If you cannot save 20% this month, you should give up on budgeting.',
                      explanation:
                        'A smaller start is still a start. Consistency matters more than a perfect percentage.',
                      options: [{ text: 'True' }, { text: 'False', isCorrect: true }],
                    },
                  ],
                },
              },
              {
                slug: 'emergency-fund',
                title: 'Your First Emergency Fund',
                summary: 'Why a small safety net changes how you handle surprises.',
                objective: 'Explain the purpose and target size of an emergency fund.',
                estimatedMinutes: 6,
                accessTier: AccessTier.FREE,
                blocks: [
                  heading('Your first financial safety net'),
                  paragraph(
                    'An emergency fund is money set aside for unexpected essential expenses: a medical bill, a sudden repair or a short gap between jobs.',
                  ),
                  bulletList([
                    'Aim for 3–6 months of essential expenses',
                    'Keep it in a separate savings account',
                    'Use it only for real emergencies',
                    'Replenish it after you use it',
                  ]),
                  callout(
                    'Hinglish tip',
                    'Emergency fund invest karne ke liye nahi hai — pehle usse banao.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['3–6 months', 'Separate account', 'Emergencies only', 'Replenish']),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedAdmin(): Promise<void> {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
  });

  await prisma.adminUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      name: 'SmartMe Admin',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'SmartMe Admin',
      role: AdminRole.SUPER_ADMIN,
    },
  });
}

async function seedLearner(): Promise<void> {
  const now = new Date();
  const passwordHash = await argon2.hash(LEARNER_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
  });

  const learner = await prisma.user.upsert({
    where: { email: LEARNER_EMAIL },
    update: {
      passwordHash,
      name: 'Demo Learner',
      status: 'ACTIVE',
      emailVerifiedAt: now,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      termsVersion: '2026-10-21',
    },
    create: {
      email: LEARNER_EMAIL,
      passwordHash,
      name: 'Demo Learner',
      emailVerifiedAt: now,
      onboardingCompletedAt: now,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      termsVersion: '2026-10-21',
      timeZone: TIME_ZONE,
      locale: 'en-IN',
    },
  });

  await prisma.userIdentity.upsert({
    where: {
      provider_providerUserId: { provider: 'EMAIL', providerUserId: LEARNER_EMAIL },
    },
    update: { providerEmail: LEARNER_EMAIL },
    create: {
      userId: learner.id,
      provider: 'EMAIL',
      providerUserId: LEARNER_EMAIL,
      providerEmail: LEARNER_EMAIL,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: learner.id },
    update: {},
    create: {
      userId: learner.id,
      occupation: 'Student',
      city: 'Jaipur',
      headline: 'Preparing for my first job',
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: learner.id },
    update: {
      learningGoal: LearningGoal.INTERVIEW_PREPARATION,
      proficiency: ProficiencyLevel.ELEMENTARY,
      explanationLanguage: ContentLanguage.HINGLISH,
      dailyGoalMinutes: 10,
      interests: ['interviews', 'english-speaking', 'money-basics'],
    },
    create: {
      userId: learner.id,
      learningGoal: LearningGoal.INTERVIEW_PREPARATION,
      proficiency: ProficiencyLevel.ELEMENTARY,
      explanationLanguage: ContentLanguage.HINGLISH,
      dailyGoalMinutes: 10,
      interests: ['interviews', 'english-speaking', 'money-basics'],
    },
  });

  await prisma.userStats.upsert({
    where: { userId: learner.id },
    update: {},
    create: { userId: learner.id },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: learner.id },
    update: {},
    create: {
      userId: learner.id,
      dailyReminder: true,
      incompleteLessonReminder: true,
      streakReminder: true,
      newLessonAnnouncements: true,
      reminderTimeLocal: '19:00',
    },
  });
}

async function seedPlansAndAchievements(): Promise<void> {
  const plans = [
    {
      code: 'premium-monthly',
      name: 'Premium Monthly',
      billingPeriod: BillingPeriod.MONTHLY,
      priceInPaise: 24900,
      googlePlayProductId: 'smartme_premium_monthly',
      benefits: ['Full course library', 'Premium practice sets', 'Expanded audio access'],
      order: 1,
    },
    {
      code: 'premium-annual',
      name: 'Premium Annual',
      billingPeriod: BillingPeriod.YEARLY,
      priceInPaise: 179900,
      googlePlayProductId: 'smartme_premium_annual',
      benefits: [
        'Full course library',
        'Premium practice sets',
        'Expanded audio access',
        'Two months free compared with monthly',
      ],
      order: 2,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: { ...plan, isActive: true },
      create: plan,
    });
  }

  const achievements = [
    {
      code: 'FIRST_LESSON',
      title: 'First Lesson',
      description: 'Complete your first lesson.',
      xpReward: 0,
      criteria: { type: 'LESSONS_COMPLETED', target: 1 },
      order: 1,
    },
    {
      code: 'FIRST_QUIZ',
      title: 'First Quiz',
      description: 'Complete your first quiz.',
      xpReward: 0,
      criteria: { type: 'QUIZZES_COMPLETED', target: 1 },
      order: 2,
    },
    {
      code: 'STREAK_3',
      title: 'Three-Day Streak',
      description: 'Learn for three days in a row.',
      xpReward: 0,
      criteria: { type: 'STREAK', target: 3 },
      order: 3,
    },
    {
      code: 'STREAK_7',
      title: 'Seven-Day Streak',
      description: 'Learn for seven days in a row.',
      xpReward: 0,
      criteria: { type: 'STREAK', target: 7 },
      order: 4,
    },
    {
      code: 'LESSONS_10',
      title: 'Ten Lessons',
      description: 'Complete ten lessons.',
      xpReward: 0,
      criteria: { type: 'LESSONS_COMPLETED', target: 10 },
      order: 5,
    },
    {
      code: 'DAILY_GOAL_ACHIEVED',
      title: 'Goal Getter',
      description: 'Reach your daily learning goal.',
      xpReward: 0,
      criteria: { type: 'DAILY_GOAL', target: 1 },
      order: 6,
    },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: {
        title: achievement.title,
        description: achievement.description,
        criteria: achievement.criteria,
        order: achievement.order,
        isActive: true,
      },
      create: achievement,
    });
  }
}

async function upsertQuiz(lessonId: string | null, quiz: SeedQuiz): Promise<void> {
  const dbQuiz = await prisma.quiz.upsert({
    where: { slug: quiz.slug },
    update: {
      lessonId,
      title: quiz.title,
      description: quiz.description,
      kind: quiz.kind ?? QuizKind.LESSON,
      xpReward: quiz.xpReward ?? 5,
      status: PublicationStatus.PUBLISHED,
    },
    create: {
      slug: quiz.slug,
      lessonId,
      title: quiz.title,
      description: quiz.description,
      kind: quiz.kind ?? QuizKind.LESSON,
      xpReward: quiz.xpReward ?? 5,
      status: PublicationStatus.PUBLISHED,
    },
  });

  // Upsert by order so existing question/option IDs survive a reseed. This
  // keeps quiz answer history valid and lets content history use RESTRICT.
  for (const [index, question] of quiz.questions.entries()) {
    const dbQuestion = await prisma.question.upsert({
      where: { quizId_order: { quizId: dbQuiz.id, order: index } },
      update: {
        type: question.type,
        prompt: question.prompt,
        scenario: question.scenario,
        explanation: question.explanation,
      },
      create: {
        quizId: dbQuiz.id,
        type: question.type,
        prompt: question.prompt,
        scenario: question.scenario,
        explanation: question.explanation,
        order: index,
      },
    });

    for (const [optionIndex, option] of question.options.entries()) {
      await prisma.questionOption.upsert({
        where: {
          questionId_order: { questionId: dbQuestion.id, order: optionIndex },
        },
        update: {
          text: option.text,
          isCorrect: option.isCorrect ?? false,
          feedback: option.feedback,
        },
        create: {
          questionId: dbQuestion.id,
          text: option.text,
          isCorrect: option.isCorrect ?? false,
          feedback: option.feedback,
          order: optionIndex,
        },
      });
    }

    await prisma.questionOption.deleteMany({
      where: {
        questionId: dbQuestion.id,
        order: { gte: question.options.length },
      },
    });
  }

  await prisma.question.deleteMany({
    where: {
      quizId: dbQuiz.id,
      order: { gte: quiz.questions.length },
    },
  });
}

async function seedLesson(moduleId: string, lesson: SeedLesson, order: number): Promise<void> {
  const dbLesson = await prisma.lesson.upsert({
    where: { moduleId_slug: { moduleId, slug: lesson.slug } },
    update: {
      title: lesson.title,
      summary: lesson.summary,
      objective: lesson.objective,
      estimatedMinutes: lesson.estimatedMinutes,
      accessTier: lesson.accessTier,
      difficulty: lesson.difficulty ?? ProficiencyLevel.BEGINNER,
      requiresQuiz: lesson.requiresQuiz ?? false,
      order,
      status: PublicationStatus.PUBLISHED,
      completionCriteria: {
        type: 'READ_TO_END',
        requiresQuiz: lesson.requiresQuiz ?? false,
      },
    },
    create: {
      moduleId,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      objective: lesson.objective,
      estimatedMinutes: lesson.estimatedMinutes,
      accessTier: lesson.accessTier,
      difficulty: lesson.difficulty ?? ProficiencyLevel.BEGINNER,
      requiresQuiz: lesson.requiresQuiz ?? false,
      order,
      status: PublicationStatus.PUBLISHED,
      publishedAt: new Date(),
      completionCriteria: {
        type: 'READ_TO_END',
        requiresQuiz: lesson.requiresQuiz ?? false,
      },
    },
  });

  await prisma.lessonContentBlock.deleteMany({ where: { lessonId: dbLesson.id } });
  await prisma.lessonContentBlock.createMany({
    data: lesson.blocks.map((block, index) => ({
      lessonId: dbLesson.id,
      type: block.type,
      order: index,
      payload: block.payload,
    })),
  });

  if (lesson.quiz) {
    await upsertQuiz(dbLesson.id, lesson.quiz);
  }
}

async function seedCourse(pathId: string, course: SeedCourse, order: number): Promise<void> {
  const dbCourse = await prisma.course.upsert({
    where: { learningPathId_slug: { learningPathId: pathId, slug: course.slug } },
    update: {
      title: course.title,
      shortDescription: course.shortDescription,
      description: course.description,
      objectives: course.objectives,
      difficulty: course.difficulty,
      estimatedMinutes: course.estimatedMinutes,
      accessTier: course.accessTier,
      order,
      status: PublicationStatus.PUBLISHED,
      availableLanguages: [ContentLanguage.ENGLISH, ContentLanguage.HINGLISH],
    },
    create: {
      learningPathId: pathId,
      slug: course.slug,
      title: course.title,
      shortDescription: course.shortDescription,
      description: course.description,
      objectives: course.objectives,
      difficulty: course.difficulty,
      estimatedMinutes: course.estimatedMinutes,
      accessTier: course.accessTier,
      order,
      status: PublicationStatus.PUBLISHED,
      publishedAt: new Date(),
      availableLanguages: [ContentLanguage.ENGLISH, ContentLanguage.HINGLISH],
    },
  });

  for (const [moduleIndex, module] of course.modules.entries()) {
    const dbModule = await prisma.courseModule.upsert({
      where: { courseId_slug: { courseId: dbCourse.id, slug: module.slug } },
      update: {
        title: module.title,
        description: module.description,
        estimatedMinutes: module.estimatedMinutes,
        order: moduleIndex,
      },
      create: {
        courseId: dbCourse.id,
        slug: module.slug,
        title: module.title,
        description: module.description,
        estimatedMinutes: module.estimatedMinutes,
        order: moduleIndex,
      },
    });

    for (const [lessonIndex, lesson] of module.lessons.entries()) {
      await seedLesson(dbModule.id, lesson, lessonIndex);
    }
  }
}

async function seedCurriculum(): Promise<void> {
  for (const [pathIndex, path] of curriculum.entries()) {
    const dbPath = await prisma.learningPath.upsert({
      where: { slug: path.slug },
      update: {
        title: path.title,
        description: path.description,
        order: pathIndex,
        status: PublicationStatus.PUBLISHED,
        availableLanguages: [ContentLanguage.ENGLISH, ContentLanguage.HINGLISH],
      },
      create: {
        slug: path.slug,
        title: path.title,
        description: path.description,
        order: pathIndex,
        status: PublicationStatus.PUBLISHED,
        publishedAt: new Date(),
        availableLanguages: [ContentLanguage.ENGLISH, ContentLanguage.HINGLISH],
      },
    });

    for (const [courseIndex, course] of path.courses.entries()) {
      await seedCourse(dbPath.id, course, courseIndex);
    }
  }
}

function localDateToUtcDate(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string): number => {
    const part = parts.find((candidate) => candidate.type === type);
    if (!part) throw new Error(`Could not determine ${type} for time zone ${timeZone}`);
    return Number(part.value);
  };

  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

async function seedDailyChallenge(): Promise<void> {
  const dailyQuiz: SeedQuiz = {
    slug: 'quiz-daily-money-check',
    title: 'Daily Money Check',
    description: 'Two quick questions to keep your money habits sharp.',
    kind: QuizKind.DAILY_CHALLENGE,
    xpReward: 10,
    questions: [
      {
        type: QuestionType.SCENARIO,
        prompt: 'You receive an unexpected ₹5,000 bonus. What is the most useful first step?',
        explanation:
          'Putting a windfall toward your safety net or a planned goal protects future you. Spending decisions can wait a day.',
        options: [
          { text: 'Spend it immediately before you change your mind.' },
          {
            text: 'Add it to your emergency fund or a planned savings goal.',
            isCorrect: true,
          },
          { text: 'Take a loan to buy something bigger.' },
          { text: 'Ignore it and hope it stays in the account.' },
        ],
      },
      {
        type: QuestionType.SINGLE_CHOICE,
        prompt: "Which expense is a 'need' in the 50-30-20 rule?",
        explanation:
          'Rent is an essential cost of living. Subscriptions and restaurant meals are wants.',
        options: [
          { text: 'Streaming subscription' },
          { text: 'Weekend restaurant meal' },
          { text: 'House rent', isCorrect: true },
          { text: 'New shoes on sale' },
        ],
      },
    ],
  };

  await upsertQuiz(null, dailyQuiz);

  const quiz = await prisma.quiz.findUniqueOrThrow({ where: { slug: dailyQuiz.slug } });
  const challengeDate = localDateToUtcDate(TIME_ZONE);

  await prisma.dailyChallenge.upsert({
    where: { challengeDate },
    update: {
      title: 'Today’s money challenge',
      description: 'Two questions on saving and everyday spending.',
      quizId: quiz.id,
      xpReward: 10,
      isActive: true,
    },
    create: {
      challengeDate,
      title: 'Today’s money challenge',
      description: 'Two questions on saving and everyday spending.',
      quizId: quiz.id,
      xpReward: 10,
      isActive: true,
    },
  });
}

async function main(): Promise<void> {
  console.log('Seeding SmartMe…');

  await seedAdmin();
  await seedLearner();
  await seedPlansAndAchievements();
  await seedCurriculum();
  await seedDailyChallenge();

  const [paths, courses, modules, lessons, quizzes, questions] = await Promise.all([
    prisma.learningPath.count(),
    prisma.course.count(),
    prisma.courseModule.count(),
    prisma.lesson.count(),
    prisma.quiz.count(),
    prisma.question.count(),
  ]);

  console.log('Seed complete.');
  console.log(
    `  ${paths} paths · ${courses} courses · ${modules} modules · ${lessons} lessons · ${quizzes} quizzes · ${questions} questions`,
  );
  console.log(`  Admin:   ${ADMIN_EMAIL}`);
  console.log(`  Learner: ${LEARNER_EMAIL}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
