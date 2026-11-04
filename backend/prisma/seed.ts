/**
 * Development seed.
 *
 * Creates:
 * - a super-admin account
 * - a demo learner with onboarding preferences
 * - subscription plans and achievement definitions
 * - three published learning paths with seven courses and 32 playable lessons
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
      {
        slug: 'english-for-daily-life',
        title: 'English for Daily Life',
        shortDescription:
          'Handle everyday situations in English without freezing or over-preparing.',
        description:
          'Practical English for the situations you meet every week: ordering food, asking directions, shopping, phone calls and short messages. Each lesson gives you a small script you can adapt.',
        objectives: [
          'Make polite requests in shops and restaurants',
          'Ask for and follow directions',
          'Handle a phone call and leave a clear voicemail',
          'Write a short, useful message',
        ],
        difficulty: ProficiencyLevel.BEGINNER,
        estimatedMinutes: 40,
        accessTier: AccessTier.FREE,
        modules: [
          {
            slug: 'out-and-about',
            title: 'Out and About',
            description: 'Speak clearly in shops, restaurants and on the street.',
            estimatedMinutes: 20,
            lessons: [
              {
                slug: 'ordering-food',
                title: 'Ordering Food with Confidence',
                summary: 'Order what you actually want, ask questions and handle a mix-up.',
                objective: 'Place a food order politely and ask one clarifying question.',
                estimatedMinutes: 5,
                accessTier: AccessTier.FREE,
                requiresQuiz: true,
                blocks: [
                  heading('A simple order has three parts'),
                  paragraph(
                    'Most restaurant conversations follow the same pattern: greet, order, confirm. You do not need long sentences — you need to be clear.',
                  ),
                  bulletList([
                    'Start with “Could I have…?” or “I’d like…”',
                    'Say the quantity and the item: “one masala dosa”',
                    'Add one preference: “less spicy, please”',
                    'Confirm the total before paying',
                  ]),
                  conversation([
                    { speaker: 'You', text: 'Could I have one masala dosa, please?' },
                    { speaker: 'Server', text: 'Sure. Anything to drink?' },
                    {
                      speaker: 'You',
                      text: 'A small coffee, please. Could you make the dosa less spicy?',
                    },
                    { speaker: 'Server', text: 'Of course. That will be ₹180.' },
                  ]),
                  callout(
                    'Hinglish tip',
                    '“Please” aur “Could I…?” add karne se request polite lagti hai. Perfect grammar se zyada tone matter karta hai.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['Greet', 'Order clearly', 'Add one preference', 'Confirm the total']),
                ],
                quiz: {
                  slug: 'quiz-ordering-food',
                  title: 'Ordering food check',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SCENARIO,
                      prompt: 'You want one coffee with less sugar. What is the clearest request?',
                      explanation:
                        'State the item and the preference in one short sentence. “Could I have” keeps it polite.',
                      options: [
                        { text: 'Coffee.' },
                        {
                          text: 'Could I have one coffee with less sugar, please?',
                          isCorrect: true,
                        },
                        { text: 'Sugar is not good for me.' },
                        { text: 'Give me coffee, no sugar, fast.' },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt: 'You should confirm the total before paying.',
                      explanation:
                        'Confirming the total avoids surprises and gives you a chance to correct the order.',
                      options: [{ text: 'True', isCorrect: true }, { text: 'False' }],
                    },
                  ],
                },
              },
              {
                slug: 'asking-directions',
                title: 'Asking for Directions',
                summary: 'Get to the right place even when you are not sure of the words.',
                objective: 'Ask for directions and repeat the answer back to confirm it.',
                estimatedMinutes: 5,
                accessTier: AccessTier.FREE,
                blocks: [
                  heading('Ask small, confirm often'),
                  paragraph(
                    'A good directions question is specific. Instead of “Where is the station?”, say which station and what you need nearby.',
                  ),
                  bulletList([
                    '“Excuse me, how do I get to …?”',
                    '“Is it walking distance?”',
                    '“Should I turn left or right at the signal?”',
                    'Repeat back: “So, straight and then left at the bank?”',
                  ]),
                  conversation([
                    { speaker: 'You', text: 'Excuse me, how do I get to the metro station?' },
                    {
                      speaker: 'Passer-by',
                      text: 'Go straight for two minutes, then turn left after the bank.',
                    },
                    {
                      speaker: 'You',
                      text: 'Straight, then left after the bank. Is it walking distance?',
                    },
                    { speaker: 'Passer-by', text: 'Yes, about five minutes.' },
                  ]),
                  callout(
                    'Useful phrase',
                    '“Sorry, I didn’t catch that. Could you say it again more slowly?”',
                  ),
                  recap([
                    'Be specific',
                    'Ask about distance',
                    'Repeat the route',
                    'Thank the person',
                  ]),
                ],
              },
              {
                slug: 'shopping-and-bargaining',
                title: 'Shopping and Polite Bargaining',
                summary: 'Ask about size, price and returns without sounding rude.',
                objective: 'Ask three useful questions in a shop and respond to a price.',
                estimatedMinutes: 5,
                accessTier: AccessTier.FREE,
                blocks: [
                  heading('Ask before you decide'),
                  paragraph(
                    'Shopping English is mostly questions. Ask early so you do not waste time or money on the wrong thing.',
                  ),
                  bulletList([
                    '“Do you have this in a larger size?”',
                    '“How much is this?”',
                    '“Can I exchange it if it does not fit?”',
                    '“Is there any discount on this?”',
                  ]),
                  conversation([
                    { speaker: 'You', text: 'How much is this shirt?' },
                    { speaker: 'Shopkeeper', text: '₹899.' },
                    {
                      speaker: 'You',
                      text: 'It’s a little above my budget. Is there any discount if I take two?',
                    },
                    { speaker: 'Shopkeeper', text: 'I can do ₹1,600 for two.' },
                  ]),
                  callout(
                    'Hinglish tip',
                    'Bargaining mein smile aur “any discount?” kaafi hai. Aggressive tone se deal bigad jaati hai.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['Ask for size', 'Ask the price', 'Check returns', 'Negotiate politely']),
                ],
              },
              {
                slug: 'talking-to-strangers',
                title: 'Starting a Conversation with a Stranger',
                summary: 'Two safe openers and one graceful exit.',
                objective: 'Start and end a short conversation with a stranger.',
                estimatedMinutes: 5,
                accessTier: AccessTier.FREE,
                blocks: [
                  heading('Use the shared moment'),
                  paragraph(
                    'You already have something in common with a stranger: the place, the event or the wait. Use that instead of a personal question.',
                  ),
                  bulletList([
                    '“Is this your first time here?”',
                    '“Have you tried the food here?”',
                    '“That was a long queue, wasn’t it?”',
                    'To leave: “It was nice talking to you. I should get going.”',
                  ]),
                  callout(
                    'Comfort check',
                    'If the other person gives one-word answers and does not ask anything back, let the conversation end. That is polite, not rude.',
                  ),
                  conversation([
                    { speaker: 'You', text: 'Is this your first time at this workshop?' },
                    { speaker: 'Stranger', text: 'Yes. I mostly came for the networking session.' },
                    { speaker: 'You', text: 'Same here. Which session are you staying for?' },
                  ]),
                  recap([
                    'Use the shared moment',
                    'Ask an open question',
                    'Share a little',
                    'Exit politely',
                  ]),
                ],
              },
            ],
          },
          {
            slug: 'phone-and-digital',
            title: 'Phone and Digital',
            description: 'Sound clear on a call and write messages people can act on.',
            estimatedMinutes: 20,
            lessons: [
              {
                slug: 'making-a-phone-call',
                title: 'Making a Phone Call',
                summary: 'Open the call, state your purpose and confirm the next step.',
                objective: 'Make a short, purposeful phone call in English.',
                estimatedMinutes: 5,
                accessTier: AccessTier.FREE,
                requiresQuiz: true,
                blocks: [
                  heading('Say who you are and why you are calling'),
                  paragraph(
                    'On a call, the other person cannot see your face. Give context in the first two sentences.',
                  ),
                  bulletList([
                    '“Hello, this is Asha calling from …”',
                    '“I’m calling about …”',
                    '“Is this a good time to talk?”',
                    '“Let me confirm: you will send the form by Friday?”',
                  ]),
                  conversation([
                    {
                      speaker: 'You',
                      text: 'Hello, this is Asha calling about the delivery scheduled for tomorrow.',
                    },
                    { speaker: 'Support', text: 'Yes, how can I help?' },
                    {
                      speaker: 'You',
                      text: 'The address on the order is missing a flat number. Can I update it?',
                    },
                    { speaker: 'Support', text: 'Sure, please share the order ID.' },
                  ]),
                  callout(
                    'Hinglish tip',
                    'Phone par dheere boliye aur naam clearly boliye. “This is…” se introduction simple ho jata hai.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap([
                    'Introduce yourself',
                    'State the purpose',
                    'Ask if it is a good time',
                    'Confirm the next step',
                  ]),
                ],
                quiz: {
                  slug: 'quiz-making-a-phone-call',
                  title: 'Phone call check',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SINGLE_CHOICE,
                      prompt: 'Which opening gives the listener context immediately?',
                      explanation:
                        'The listener needs your name and the reason for the call before the details.',
                      options: [
                        { text: 'Hello? Hello? Can you hear me?' },
                        {
                          text: 'Hello, this is Asha calling about tomorrow’s delivery.',
                          isCorrect: true,
                        },
                        { text: 'I have a problem.' },
                        { text: 'Who is this?' },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt: 'It is useful to confirm the next step before ending a call.',
                      explanation:
                        'A short recap prevents misunderstandings about who will do what.',
                      options: [{ text: 'True', isCorrect: true }, { text: 'False' }],
                    },
                  ],
                },
              },
              {
                slug: 'leaving-a-voicemail',
                title: 'Leaving a Clear Voicemail',
                summary: 'A 20-second message with your name, reason and number.',
                objective: 'Leave a voicemail that is easy to return.',
                estimatedMinutes: 5,
                accessTier: AccessTier.FREE,
                blocks: [
                  heading('The four-part voicemail'),
                  paragraph(
                    'A good voicemail is shorter than most people think. Say who you are, why you called, what you need and how to reach you.',
                  ),
                  bulletList([
                    'Name and organisation',
                    'One sentence on the reason',
                    'The action you need',
                    'Your number, said slowly',
                  ]),
                  conversation([
                    {
                      speaker: 'You',
                      text: 'Hello, this is Asha Sharma from Bright Stores. I’m calling about invoice 204. Could you confirm the payment date? You can reach me on 98… again, 98… Thank you.',
                    },
                  ]),
                  callout(
                    'Small habit',
                    'Say your phone number twice, slowly. Most people replay voicemails only to catch the number.',
                  ),
                  recap(['Name', 'Reason', 'Action', 'Number twice']),
                ],
              },
              {
                slug: 'writing-a-message',
                title: 'Writing a Short Message',
                summary: 'Messages that get a reply, not a “what?”.',
                objective: 'Write a short message with context, request and deadline.',
                estimatedMinutes: 5,
                accessTier: AccessTier.FREE,
                blocks: [
                  heading('Context, request, deadline'),
                  paragraph(
                    'A useful message answers three questions before the reader asks them: what is this about, what do you need, and by when?',
                  ),
                  paragraph(
                    'Weak: “Hi, are you free?” Strong: “Hi Ravi, can we move tomorrow’s 4 pm review to 5 pm? I have a client call at 4. Please confirm by 6 pm today.”',
                  ),
                  bulletList([
                    'Put the request in the first two lines',
                    'Give the reason in one sentence',
                    'Use a specific time, not “soon”',
                    'End with a clear question',
                  ]),
                  callout(
                    'Hinglish tip',
                    'Message mein “sometime” ya “ASAP” likhne se confusion badhta hai. Exact time dijiye.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['Context', 'Request', 'Reason', 'Deadline']),
                ],
              },
              {
                slug: 'apologising-and-rescheduling',
                title: 'Apologising and Rescheduling',
                summary: 'Fix a missed commitment without over-explaining.',
                objective: 'Apologise for a change and propose a new time.',
                estimatedMinutes: 5,
                accessTier: AccessTier.FREE,
                blocks: [
                  heading('Apologise once, then solve'),
                  paragraph(
                    'A good apology is short: acknowledge the impact, take responsibility, offer a concrete fix. Long excuses make the other person do more work.',
                  ),
                  bulletList([
                    '“I’m sorry, I won’t be able to make the 3 pm call.”',
                    '“That was my mistake — I missed the reminder.”',
                    '“Can we move it to 5 pm today or 10 am tomorrow?”',
                    '“I’ve sent the updated invite.”',
                  ]),
                  conversation([
                    {
                      speaker: 'You',
                      text: 'Hi Meera, I’m sorry — I have to reschedule our 3 pm call. I double-booked a client meeting. Would 5 pm today or 10 am tomorrow work for you?',
                    },
                    { speaker: 'Meera', text: '5 pm works. Thanks for the quick note.' },
                  ]),
                  callout(
                    'Avoid',
                    'Do not say “I’m sorry but…” and then blame traffic, the weather and your phone. One reason is enough.',
                  ),
                  recap([
                    'Acknowledge',
                    'Take responsibility',
                    'Offer two times',
                    'Confirm the change',
                  ]),
                ],
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
      {
        slug: 'workplace-success',
        title: 'Workplace Success',
        shortDescription:
          'Build trust in your first job: updates, feedback, mistakes and boundaries.',
        description:
          'A practical course for early-career professionals. Learn how to clarify expectations, communicate progress and handle difficult moments without losing credibility.',
        objectives: [
          'Clarify what success looks like in your role',
          'Give short, useful status updates',
          'Receive feedback and own mistakes',
          'Disagree and negotiate deadlines professionally',
        ],
        difficulty: ProficiencyLevel.INTERMEDIATE,
        estimatedMinutes: 40,
        accessTier: AccessTier.PREMIUM,
        modules: [
          {
            slug: 'first-90-days',
            title: 'Your First 90 Days',
            description: 'Understand the job before trying to change it.',
            estimatedMinutes: 20,
            lessons: [
              {
                slug: 'understanding-your-role',
                title: 'Understanding Your Role',
                summary: 'Turn a vague job description into clear weekly priorities.',
                objective: 'Identify your three main responsibilities and one success measure.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('Clarify before you optimise'),
                  paragraph(
                    'New joiners often work hard on the wrong things. Before your first full week, ask your manager what success looks like in 30, 60 and 90 days.',
                  ),
                  bulletList([
                    'Which three outcomes matter most this quarter?',
                    'What does “done” look like for each one?',
                    'Who depends on my work, and who do I depend on?',
                    'What should I check with you before deciding?',
                  ]),
                  callout(
                    'Useful question',
                    '“If I do only three things well this month, what should they be?”',
                  ),
                  recap([
                    'Three outcomes',
                    'Definition of done',
                    'Dependencies',
                    'Escalation points',
                  ]),
                ],
              },
              {
                slug: 'asking-good-questions',
                title: 'Asking Questions at Work',
                summary: 'Ask once, clearly, and show what you already tried.',
                objective: 'Ask a question that respects the other person’s time.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('A good question includes context'),
                  paragraph(
                    '“It’s not working” forces the other person to interview you. A useful question says what you tried, what happened and what you need.',
                  ),
                  bulletList([
                    'What I am trying to do',
                    'What I tried',
                    'What happened instead',
                    'The specific decision or answer I need',
                  ]),
                  paragraph(
                    'Example: “I’m trying to publish the new lesson. I saved it as draft and clicked publish, but the app still shows the old version. Should I wait, or is there a cache step I missed?”',
                  ),
                  callout(
                    'Hinglish tip',
                    'Sawaal poochhne se pehle ek minute khud try kijiye. Phir context ke saath poochhiye — log zyada help karte hain.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['Context', 'What you tried', 'What happened', 'Exact ask']),
                ],
              },
              {
                slug: 'giving-a-status-update',
                title: 'Giving a Status Update',
                summary: 'Report progress in a way that surfaces risk early.',
                objective: 'Write a three-line status update with progress, risk and next step.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                requiresQuiz: true,
                blocks: [
                  heading('Progress, risk, next step'),
                  paragraph(
                    'A status update is not a diary. It tells the reader what changed, what might go wrong and what happens next.',
                  ),
                  bulletList([
                    'Done: what is complete or shipped',
                    'In progress: what is moving and when it lands',
                    'Risk: what could delay it and what you need',
                    'Next: the next decision or milestone',
                  ]),
                  paragraph(
                    'Example: “Done: the quiz screen and results. In progress: offline retry, expected Thursday. Risk: the API timeout test needs a staging URL. Next: review with Priya on Friday.”',
                  ),
                  callout(
                    'Rule of thumb',
                    'If a risk is worth mentioning later, it is worth mentioning now. Early bad news is a plan; late bad news is a surprise.',
                  ),
                  recap(['Done', 'In progress', 'Risk', 'Next step']),
                ],
                quiz: {
                  slug: 'quiz-giving-a-status-update',
                  title: 'Status update check',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SINGLE_CHOICE,
                      prompt: 'Which update is most useful to a busy manager?',
                      explanation:
                        'A useful update names progress, risk and the next step. It does not require follow-up questions.',
                      options: [
                        { text: 'Working on it.' },
                        { text: 'Lots of progress this week.' },
                        {
                          text: 'Quiz screen done; retry work lands Thursday; API test blocked on a staging URL; review Friday.',
                          isCorrect: true,
                        },
                        { text: 'Will update soon.' },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt: 'Risks should be shared only after they become delays.',
                      explanation:
                        'Early risks let the team adjust the plan. Waiting turns a risk into a surprise.',
                      options: [{ text: 'True' }, { text: 'False', isCorrect: true }],
                    },
                  ],
                },
              },
              {
                slug: 'receiving-feedback',
                title: 'Receiving Feedback Well',
                summary: 'Listen, clarify and act without getting defensive.',
                objective: 'Respond to critical feedback with a clear next action.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('Separate the message from the delivery'),
                  paragraph(
                    'Feedback can be clumsy and still be useful. Your job in the moment is to understand the message, not to win the conversation.',
                  ),
                  bulletList([
                    'Listen without interrupting',
                    'Ask for one concrete example',
                    'Summarise what you heard',
                    'Name one thing you will change',
                  ]),
                  conversation([
                    {
                      speaker: 'Manager',
                      text: 'Your updates are too detailed. I lose the main point.',
                    },
                    {
                      speaker: 'You',
                      text: 'That’s helpful. So you want the decision or risk first, and details only if needed?',
                    },
                    {
                      speaker: 'Manager',
                      text: 'Yes — three lines maximum unless something is on fire.',
                    },
                  ]),
                  callout(
                    'Hinglish tip',
                    'Feedback ko personal attack mat samjhiye. “Ek example dijiye” poochhna professional hota hai.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['Listen', 'Ask for an example', 'Summarise', 'Name one change']),
                ],
              },
            ],
          },
          {
            slug: 'working-with-people',
            title: 'Working with People',
            description: 'Handle mistakes, disagreement and boundaries.',
            estimatedMinutes: 20,
            lessons: [
              {
                slug: 'handling-a-mistake',
                title: 'Handling a Mistake at Work',
                summary: 'Contain the damage, own it and prevent a repeat.',
                objective: 'Report a mistake with impact, fix and prevention.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                requiresQuiz: true,
                blocks: [
                  heading('Report early, with a fix'),
                  paragraph(
                    'Everyone makes mistakes. Trust is lost when the mistake is hidden or the fix is unclear.',
                  ),
                  bulletList([
                    'Say what happened in one line',
                    'State the impact and who is affected',
                    'Propose the immediate fix',
                    'Explain the change that prevents a repeat',
                  ]),
                  conversation([
                    {
                      speaker: 'You',
                      text: 'I sent the client the old price list. They have not opened it yet. I’ve recalled the email and will resend the correct file in ten minutes. I’ve also added a checklist step before sending pricing.',
                    },
                    {
                      speaker: 'Manager',
                      text: 'Thanks for flagging it quickly. Send the corrected file and copy me.',
                    },
                  ]),
                  callout(
                    'Avoid',
                    'Do not lead with a long explanation of why it was not really your fault. Lead with impact and fix.',
                  ),
                  recap(['What happened', 'Impact', 'Immediate fix', 'Prevention']),
                ],
                quiz: {
                  slug: 'quiz-handling-a-mistake',
                  title: 'Mistake recovery check',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SCENARIO,
                      prompt:
                        'You emailed a customer the wrong document. What is the best first message?',
                      explanation:
                        'The team needs the impact and the fix first. Explanations can follow once the situation is contained.',
                      options: [
                        { text: 'Nobody noticed, so I will wait.' },
                        {
                          text: 'I sent the wrong file; here is the correct one and what I changed to prevent it.',
                          isCorrect: true,
                        },
                        { text: 'The file system is confusing.' },
                        { text: 'Can someone else handle this?' },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt: 'A prevention step makes a mistake report more credible.',
                      explanation:
                        'It shows you have thought about the system, not only the apology.',
                      options: [{ text: 'True', isCorrect: true }, { text: 'False' }],
                    },
                  ],
                },
              },
              {
                slug: 'disagreeing-professionally',
                title: 'Disagreeing Professionally',
                summary: 'Challenge an idea without challenging the person.',
                objective: 'Disagree using evidence and a shared goal.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('Aim at the problem, not the person'),
                  paragraph(
                    'Disagreement is useful when it improves the decision. It becomes expensive when people feel attacked.',
                  ),
                  bulletList([
                    'Name the shared goal',
                    'Ask about the reasoning before rejecting it',
                    'Offer evidence or a concrete alternative',
                    'Signal when you are okay with being overruled',
                  ]),
                  conversation([
                    {
                      speaker: 'You',
                      text: 'I understand the goal is to ship this week. My concern is that the retry flow has no test yet. Could we ship without it and add the test Monday, or delay one day?',
                    },
                    { speaker: 'Lead', text: 'Let’s ship behind a flag and test Monday.' },
                  ]),
                  callout(
                    'Useful phrase',
                    '“Help me understand the trade-off you’re seeing.” This invites reasoning instead of a fight.',
                  ),
                  recap(['Shared goal', 'Ask first', 'Bring evidence', 'Accept the decision']),
                ],
              },
              {
                slug: 'negotiating-a-deadline',
                title: 'Negotiating a Deadline',
                summary: 'Trade scope and time openly instead of silently missing dates.',
                objective: 'Renegotiate a deadline by offering options.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('A deadline is a trade-off, not a test'),
                  paragraph(
                    'When a date is impossible, say so early and bring options. A calm trade-off conversation is better than a late surprise.',
                  ),
                  bulletList([
                    'State the current risk with evidence',
                    'Offer a smaller scope for the same date',
                    'Offer the full scope with a new date',
                    'Ask which outcome matters more',
                  ]),
                  paragraph(
                    'Example: “To keep Friday, I can ship the lesson player without audio download. With audio, I need until Wednesday. Which is more useful for the pilot?”',
                  ),
                  callout(
                    'Hinglish tip',
                    'Deadline miss hone ke baad batane se better hai pehle options ke saath batana. “What if we…” se shuru kijiye.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap([
                    'Raise early',
                    'Show the risk',
                    'Offer two options',
                    'Ask for the priority',
                  ]),
                ],
              },
              {
                slug: 'asking-for-a-raise',
                title: 'Asking for a Raise with Evidence',
                summary: 'Build a case from outcomes, scope and market context.',
                objective: 'Prepare a raise conversation with three pieces of evidence.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('Make the conversation about value'),
                  paragraph(
                    'A raise request is strongest when it connects your outcomes to the team’s goals. “I need more money” is a need; “here is the value I added and the scope I now own” is a case.',
                  ),
                  bulletList([
                    'Three outcomes you delivered, with numbers if possible',
                    'Work you now own beyond your original role',
                    'Market range for similar roles in your city',
                    'A specific ask and a timeline',
                  ]),
                  callout(
                    'Prepare for “not now”',
                    'Ask what would need to be true in six months, and get it in writing. A clear path is better than a vague promise.',
                  ),
                  recap(['Outcomes', 'Scope', 'Market range', 'Specific ask']),
                ],
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
      {
        slug: 'smart-money-habits',
        title: 'Smart Money Habits',
        shortDescription:
          'Read your payslip, track spending and avoid the most common money traps.',
        description:
          'A practical follow-up to Money Basics. These lessons explain salary deductions, debt, insurance and first investment concepts in plain language. They are educational and do not provide personalised financial advice.',
        objectives: [
          'Read the main lines on a salary slip',
          'Track spending without guilt',
          'Compare loans and avoid expensive traps',
          'Understand emergency funds and insurance basics',
        ],
        difficulty: ProficiencyLevel.INTERMEDIATE,
        estimatedMinutes: 40,
        accessTier: AccessTier.PREMIUM,
        modules: [
          {
            slug: 'know-your-money',
            title: 'Know Your Money',
            description: 'Understand what arrives, what leaves and why.',
            estimatedMinutes: 20,
            lessons: [
              {
                slug: 'reading-your-salary-slip',
                title: 'Reading Your Salary Slip',
                summary: 'Understand gross pay, deductions and take-home pay.',
                objective: 'Identify the main lines on a salary slip and calculate take-home pay.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                requiresQuiz: true,
                blocks: [
                  heading('Gross is not what reaches your bank'),
                  paragraph(
                    'Your salary slip starts with gross pay and subtracts deductions. The amount credited is your net pay, also called take-home pay.',
                  ),
                  bulletList([
                    'Basic salary: the fixed base used for many calculations',
                    'Allowances: housing, transport, special and other additions',
                    'Statutory deductions: provident fund, professional tax, income tax',
                    'Other deductions: insurance premiums, loan repayments, canteen',
                    'Net pay: gross pay minus all deductions',
                  ]),
                  callout(
                    'Check every month',
                    'Compare the credited amount with the net pay line. If they differ, ask payroll before the next cycle.',
                  ),
                  callout(
                    'Educational only',
                    'Tax rules change and depend on your situation. Use official guidance or a qualified professional for filing decisions.',
                  ),
                  recap(['Gross', 'Allowances', 'Deductions', 'Net pay']),
                ],
                quiz: {
                  slug: 'quiz-reading-salary-slip',
                  title: 'Salary slip check',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SINGLE_CHOICE,
                      prompt: 'What is net pay?',
                      explanation:
                        'Net pay is the amount left after all deductions are subtracted from gross pay.',
                      options: [
                        { text: 'Gross pay plus allowances' },
                        { text: 'Gross pay minus deductions', isCorrect: true },
                        { text: 'Only the basic salary' },
                        { text: 'The annual bonus' },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt: 'Professional tax and provident fund can appear as deductions.',
                      explanation: 'Both are common statutory deductions on Indian salary slips.',
                      options: [{ text: 'True', isCorrect: true }, { text: 'False' }],
                    },
                  ],
                },
              },
              {
                slug: 'tracking-your-spending',
                title: 'Tracking Your Spending',
                summary: 'A ten-minute weekly habit that replaces guesswork.',
                objective: 'Set up a simple weekly spending review.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('You cannot fix what you cannot see'),
                  paragraph(
                    'Most people underestimate small, frequent spending. You do not need a complex app; you need one place where every payment is visible.',
                  ),
                  bulletList([
                    'Use one account or card for most spending',
                    'Export or review the statement once a week',
                    'Group spending into needs, wants and savings',
                    'Look for one change, not ten',
                  ]),
                  callout(
                    'Ten-minute review',
                    'Ask three questions: What surprised me? What can I reduce next week? What worked well?',
                  ),
                  callout(
                    'Hinglish tip',
                    'Chhoti-chhoti spending yaad nahi rehti. Statement ek jagah rakhiye aur hafte mein ek baar dekhiye.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['One account', 'Weekly review', 'Three groups', 'One change']),
                ],
              },
              {
                slug: 'needs-wants-values',
                title: 'Needs, Wants and Values',
                summary: 'Spend on purpose instead of copying someone else’s lifestyle.',
                objective: 'Classify three recent expenses and name one value behind them.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('A want is not a failure'),
                  paragraph(
                    'A healthy budget includes wants. The problem is not spending on pleasure; it is spending on things you do not actually value.',
                  ),
                  bulletList([
                    'Needs keep your life running: rent, food, medicine, transport',
                    'Wants improve life: dining out, streaming, new clothes',
                    'Values explain the choice: family time, health, learning, status',
                    'A value-led want is easier to enjoy without guilt',
                  ]),
                  callout(
                    'Try this',
                    'Before a non-essential purchase, wait 24 hours. If you still want it and it fits the plan, buy it without guilt.',
                  ),
                  recap(['Needs', 'Wants', 'Values', 'Wait 24 hours']),
                ],
              },
              {
                slug: 'debt-without-shame',
                title: 'Debt Without Shame',
                summary: 'Separate useful debt from expensive debt and make a payoff plan.',
                objective: 'Compare two debts by interest rate and choose a payoff order.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('Not all debt is the same'),
                  paragraph(
                    'Debt used to buy an asset or build a skill can be manageable. Debt used to cover everyday spending at a high interest rate becomes a trap.',
                  ),
                  bulletList([
                    'List every debt: balance, interest rate, minimum payment',
                    'Pay minimums on everything first',
                    'Attack the highest-interest debt with extra money',
                    'Avoid new borrowing while paying down expensive debt',
                  ]),
                  callout(
                    'Warning signs',
                    'Borrowing to pay another loan, missing minimum payments, or hiding debt from family are signals to get help early.',
                  ),
                  callout(
                    'Hinglish tip',
                    'Loan lena buri baat nahi hai. Lekin interest rate aur repayment plan samajhna zaroori hai.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap([
                    'List debts',
                    'Pay minimums',
                    'Target high interest',
                    'Stop new borrowing',
                  ]),
                ],
              },
            ],
          },
          {
            slug: 'build-your-safety-net',
            title: 'Build Your Safety Net',
            description: 'Protect yourself before chasing returns.',
            estimatedMinutes: 20,
            lessons: [
              {
                slug: 'emergency-fund-in-practice',
                title: 'Emergency Fund in Practice',
                summary: 'Set a target, automate it and decide what counts as an emergency.',
                objective: 'Calculate a starter emergency-fund target and a monthly transfer.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('Make the safety net boring'),
                  paragraph(
                    'An emergency fund should be easy to reach and not exciting. A separate savings account or liquid fund works better than something you check every day.',
                  ),
                  bulletList([
                    'Add up one month of essential expenses',
                    'Multiply by 3 for a starter target and 6 for a full target',
                    'Automate a transfer on salary day',
                    'Define emergencies in advance: health, job loss, urgent repairs',
                  ]),
                  callout(
                    'Example',
                    'If essentials cost ₹20,000 a month, a starter target is ₹60,000. Saving ₹5,000 a month reaches it in a year.',
                  ),
                  recap([
                    'One month of essentials',
                    '3–6 months',
                    'Automate',
                    'Define emergencies',
                  ]),
                ],
              },
              {
                slug: 'insurance-basics',
                title: 'Insurance Basics',
                summary: 'Understand what health and term insurance are for.',
                objective: 'Explain the purpose of health insurance and term life insurance.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('Insurance transfers a risk you cannot absorb'),
                  paragraph(
                    'Insurance is not an investment. It protects you from a large, unlikely expense that would damage your finances.',
                  ),
                  bulletList([
                    'Health insurance covers hospital and medical costs',
                    'Term life insurance pays your family if you die during the policy',
                    'Check the sum insured, waiting periods and exclusions',
                    'Disclose health and habits honestly or a claim can be rejected',
                  ]),
                  callout(
                    'Educational only',
                    'Product features and premiums vary. Compare official policy documents and consult a qualified adviser before buying.',
                  ),
                  recap(['Health cover', 'Term cover', 'Read exclusions', 'Disclose honestly']),
                ],
              },
              {
                slug: 'avoiding-loan-traps',
                title: 'Avoiding Loan Traps',
                summary: 'Spot the real cost behind a low monthly payment.',
                objective: 'Compare loans using total cost, not only the EMI.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                requiresQuiz: true,
                blocks: [
                  heading('The EMI hides the price'),
                  paragraph(
                    'A small monthly payment can hide a long tenure and a high total interest cost. Always compare the total amount repaid, not only the EMI.',
                  ),
                  bulletList([
                    'Check the annual interest rate, not just the processing fee',
                    'Ask for the total repayment amount over the full tenure',
                    'Watch for prepayment penalties and hidden charges',
                    'Avoid loans with unclear terms or pressure to sign quickly',
                  ]),
                  callout(
                    'Red flag',
                    'A lender who will not give you the full cost in writing is not offering a good deal.',
                  ),
                  callout(
                    'Hinglish tip',
                    'EMI kam lag sakta hai, lekin total interest zyada ho sakta hai. Poora calculation maangiye.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap(['Annual rate', 'Total repayment', 'Hidden charges', 'Get it in writing']),
                ],
                quiz: {
                  slug: 'quiz-avoiding-loan-traps',
                  title: 'Loan cost check',
                  xpReward: 5,
                  questions: [
                    {
                      type: QuestionType.SINGLE_CHOICE,
                      prompt: 'Which number best shows the real cost of a loan?',
                      explanation:
                        'The total repayment includes interest and fees across the full tenure.',
                      options: [
                        { text: 'The EMI only' },
                        { text: 'The processing fee only' },
                        { text: 'The total amount repaid over the full tenure', isCorrect: true },
                        { text: 'The first payment' },
                      ],
                    },
                    {
                      type: QuestionType.TRUE_FALSE,
                      prompt: 'A lower EMI always means a cheaper loan.',
                      explanation:
                        'A lower EMI can come from a longer tenure, which often increases total interest.',
                      options: [{ text: 'True' }, { text: 'False', isCorrect: true }],
                    },
                  ],
                },
              },
              {
                slug: 'first-investment-steps',
                title: 'First Investment Steps',
                summary: 'Learn the order of operations before choosing a product.',
                objective: 'Place emergency fund, insurance and investing in a sensible order.',
                estimatedMinutes: 5,
                accessTier: AccessTier.PREMIUM,
                blocks: [
                  heading('Protect first, invest later'),
                  paragraph(
                    'Investing makes sense after expensive debt is under control and a safety net exists. The right product matters less than the right order.',
                  ),
                  bulletList([
                    'Pay down high-interest debt',
                    'Build an emergency fund',
                    'Get basic health and term cover',
                    'Invest regularly for long-term goals',
                    'Keep short-term money in low-risk options',
                  ]),
                  callout(
                    'Educational only',
                    'This lesson does not recommend a specific product. Returns are not guaranteed, and investments can lose value.',
                  ),
                  callout(
                    'Hinglish tip',
                    'Pehle safety net, phir investment. “Guaranteed high return” sunte hi sawdhan ho jaiye.',
                    ContentLanguage.HINGLISH,
                  ),
                  recap([
                    'Clear expensive debt',
                    'Emergency fund',
                    'Insurance',
                    'Long-term investing',
                    'No guarantees',
                  ]),
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
