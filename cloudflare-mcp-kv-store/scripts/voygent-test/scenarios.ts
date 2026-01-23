/**
 * Test Scenarios for Voygent Automated QA
 * Defines personas, tasks, and success criteria for each test scenario
 */

export interface TestPersona {
  name: string;
  description: string;
  experience: 'new' | 'returning' | 'expert';
  personality: string;
  goals: string[];
}

export interface SuccessCriteria {
  required: string[];
  bonus?: string[];
}

export interface TestScenario {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;  // 4 = realistic user scenarios
  persona: TestPersona;
  task: string;
  context?: string;
  maxTurns: number;
  successCriteria: SuccessCriteria;
  restrictedTools?: string[];  // Tools test agent should NOT have access to
}

// =============================================================================
// PERSONAS
// =============================================================================

const PERSONAS: Record<string, TestPersona> = {
  newAgent: {
    name: 'Sarah Chen',
    description: 'First-time travel agent who just signed up for Voygent',
    experience: 'new',
    personality: 'Eager but unfamiliar with the system. Asks clarifying questions.',
    goals: ['Learn how to use Voygent', 'Create my first trip proposal']
  },

  experiencedAgent: {
    name: 'Marcus Rivera',
    description: 'Travel agent with 6 months of Voygent experience',
    experience: 'returning',
    personality: 'Confident, knows the basics, wants efficiency',
    goals: ['Quickly create and publish trip proposals', 'Manage client feedback']
  },

  confusedUser: {
    name: 'Janet Thompson',
    description: 'User who gets confused by technology',
    experience: 'new',
    personality: 'Uses wrong terminology, makes vague requests, needs patience',
    goals: ['Figure out how to use this travel thing', 'Make a vacation plan']
  },

  cruiseSpecialist: {
    name: 'David Park',
    description: 'Agent specializing in cruise bookings',
    experience: 'expert',
    personality: 'Detail-oriented, knows cruise terminology',
    goals: ['Create detailed cruise itineraries', 'Include port excursions']
  },

  // ==========================================================================
  // REALISTIC PERSONAS - Real people with authentic life situations
  // ==========================================================================

  busyMom: {
    name: 'Michelle Torres',
    description: 'Working mom of 3 kids (ages 5, 8, 11) planning their first Disney trip. Works as a nurse with unpredictable schedule.',
    experience: 'new',
    personality: 'Multitasking constantly, gets interrupted mid-thought, asks about kid-specific things, very budget-conscious but wants magic for her kids. Types in fragments sometimes. Worried about crowds and wait times.',
    goals: ['Plan Disney World trip for spring break', 'Stay under $5000 total', 'Find kid-friendly everything']
  },

  retirees: {
    name: 'Barbara and Jim Kowalski',
    description: '68-year-old retired couple. Jim worked at Ford for 40 years, Barbara was a teacher. This is their "big retirement trip" they\'ve saved 10 years for.',
    experience: 'new',
    personality: 'Technology hesitant - Barbara does most typing, Jim looks over her shoulder with suggestions. Ask lots of questions before committing. Concerned about mobility (Jim has a bad knee). Want to see Alaska before "we\'re too old."',
    goals: ['Book Alaska cruise', 'Accessible cabin', 'See glaciers and wildlife', 'Celebrate 45th anniversary on the trip']
  },

  millennialBride: {
    name: 'Aisha Johnson',
    description: '31-year-old marketing manager planning destination wedding in Mexico. Coordinating 45 guests flying from different cities.',
    experience: 'returning',
    personality: 'Organized, uses spreadsheets for everything, wants Instagram-worthy aesthetics, stressed about coordinating everyone. Juggles work Slack messages while planning. References Pinterest boards. Wants "boho beach vibes."',
    goals: ['Plan Tulum wedding week', 'Group hotel block', 'Welcome party and farewell brunch', 'Keep it under $3500/couple for guests']
  },

  businessTraveler: {
    name: 'Kevin Okonkwo',
    description: '44-year-old VP of Sales. Flying to Singapore for conference, wants to add 4 personal days to explore Vietnam with his college buddy who lives in Ho Chi Minh City.',
    experience: 'returning',
    personality: 'Efficient, knows exactly what he wants, hates wasting time. Business communication style - direct, bullet points. But gets more casual when talking about the "fun part" of the trip. Frequent flyer, knows airports and lounges.',
    goals: ['Conference in Singapore', 'Side trip to Vietnam', 'Good hotels with status benefits', 'At least one nice dinner experience']
  },

  budgetBackpacker: {
    name: 'Tyler Reyes',
    description: '24-year-old recent grad taking gap year before med school. Saved $8000 from tutoring job. Wants to see as much of Southeast Asia as possible in 6 weeks.',
    experience: 'new',
    personality: 'Enthusiastic, flexible on everything except budget. Asks about hostels, overnight buses, street food. Uses travel slang (gap year, backpacker trail, banana pancake trail). Wants "authentic experiences not tourist traps."',
    goals: ['6 weeks in Southeast Asia', 'Thailand, Vietnam, Cambodia minimum', 'Under $8000 including flights', 'Meet other travelers']
  },

  anniversarySurprise: {
    name: 'David Moreau',
    description: '52-year-old architect planning surprise 25th anniversary trip for wife. She thinks they\'re just doing dinner locally.',
    experience: 'new',
    personality: 'Secretive, worried about leaving digital trail wife might see. Wants romance and sophistication. Wife loves wine, hates flying more than 6 hours, is vegetarian. He overthinks every detail because "she\'s planned every other vacation."',
    goals: ['Surprise trip to Napa or Sonoma', '4-5 days', 'Romantic winery experiences', 'Vegetarian fine dining', 'Hot air balloon maybe?']
  },

  familyReunion: {
    name: 'Denise Washington',
    description: '58-year-old organizing Washington family reunion - 32 people across 4 generations, ages 3 to 87. Grandma Ruby uses a wheelchair.',
    experience: 'new',
    personality: 'Natural organizer, keeps spreadsheets of everyone\'s dietary restrictions and mobility needs. Gets overwhelmed by options. Wants something that works for toddlers AND great-grandma. Family is spread across 6 states.',
    goals: ['Beach house or resort that fits everyone', 'Accessible for wheelchair', 'Activities for all ages', 'Group meals', 'Under $300/person for 5 nights']
  },

  soloFemale: {
    name: 'Priya Sharma',
    description: '35-year-old software engineer taking first solo trip after divorce. Nervous but determined to prove she can do this.',
    experience: 'new',
    personality: 'Research-heavy, reads every review, asks about safety for solo women. Wants meaningful experiences not just sightseeing. Interested in cooking classes, local experiences. Traveling alone makes her anxious but excited.',
    goals: ['2 weeks in Portugal', 'Solo-friendly activities', 'Safe neighborhoods to stay', 'Maybe meet other travelers', 'Learn to make pastéis de nata']
  },

  lastMinuteChaos: {
    name: 'Brandon Kim',
    description: '38-year-old forgot his parents\' 40th anniversary is in 2 weeks. Needs to plan something amazing FAST. Sister is furious with him.',
    experience: 'new',
    personality: 'Panicked, apologetic, throws money at problems. Makes quick decisions then second-guesses. Gets texts from angry sister during planning. Doesn\'t know parents\' travel preferences well - keeps saying "let me text my mom" for details.',
    goals: ['Anniversary trip for parents in 2 weeks', 'Has to be special to make up for forgetting', 'Budget is flexible because guilt', 'Parents are early 70s, relatively active']
  },

  groupOrganizer: {
    name: 'Stephanie Park',
    description: '29-year-old trying to organize girls trip to Nashville for best friend\'s 30th birthday. 8 women, all with different opinions.',
    experience: 'new',
    personality: 'Frustrated because everyone has different preferences and budgets. Gets contradicting texts from the group chat while planning. Some want fancy rooftop bars, others want dive bars. Trying to keep the peace. "I\'m never organizing another group trip."',
    goals: ['Nashville bachelorette-style weekend', '8 women, 3 nights', 'Mix of activities for different tastes', 'Some want Instagram spots, some want honky-tonks', 'Figure out how to split costs fairly']
  }
};

// =============================================================================
// TIER 1: CORE FLOWS (Every Run)
// =============================================================================

const CORE_SCENARIOS: TestScenario[] = [
  {
    id: 'onboarding-fresh',
    name: 'Fresh User Onboarding',
    tier: 1,
    persona: PERSONAS.newAgent,
    task: `You are a new travel agent who just connected to Voygent for the first time.
Your goal is to:
1. Understand what Voygent can do for you
2. See if there are any sample trips to help you get started
3. Accept the sample trips if offered
4. List your trips to see what you have to work with

Start by greeting the system and asking what it can help you with.`,
    maxTurns: 10,
    successCriteria: {
      required: [
        'get_context was called',
        'Sample trips were offered or mentioned',
        'User understood basic capabilities'
      ],
      bonus: [
        'list_sample_trips was called',
        'accept_sample_trips was called',
        'list_trips was called to view trips'
      ]
    },
    restrictedTools: ['publish_trip']  // New users shouldn't publish yet
  },

  {
    id: 'crud-basic',
    name: 'Basic Trip CRUD',
    tier: 1,
    persona: PERSONAS.experiencedAgent,
    task: `You need to create a new trip proposal for a client.
Your goal is to:
1. Create a new trip called "Hawaii Honeymoon" for the Johnson family
2. The trip should be 7 days to Maui in March 2025
3. After creating it, read it back to verify the data
4. Update the trip to add a pricing tier (value: $3500 per person)
5. Finally, list all trips to confirm it appears

Be efficient - you know how Voygent works.`,
    maxTurns: 12,
    successCriteria: {
      required: [
        'save_trip was called to create trip',
        'Trip was created with correct destination',
        'read_trip was called to verify',
        'patch_trip was called to add pricing',
        'list_trips was called at the end'
      ],
      bonus: [
        'Trip data structure follows schema conventions',
        'Pricing tiers properly structured'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'publish-preview',
    name: 'Publishing Flow (Preview Only)',
    tier: 1,
    persona: PERSONAS.experiencedAgent,
    context: 'You already have a trip saved called "Caribbean Cruise" with ID "caribbean-2025"',
    task: `You need to generate a preview of your Caribbean Cruise proposal.
Your goal is to:
1. First, read the trip to understand what's there
2. List available templates to see your options
3. Preview the trip publication (DO NOT actually publish)
4. Review the preview URL and confirm it looks good

Remember: Only preview, do not publish.`,
    maxTurns: 8,
    successCriteria: {
      required: [
        'read_trip was called',
        'list_templates was called',
        'preview_publish was called',
        'Preview URL was received and acknowledged'
      ],
      bonus: [
        'User mentioned checking the preview',
        'Template selection was intentional'
      ]
    },
    restrictedTools: ['publish_trip']  // Critical: test agent cannot publish
  }
];

// =============================================================================
// TIER 2: FEATURE COVERAGE
// =============================================================================

const FEATURE_SCENARIOS: TestScenario[] = [
  {
    id: 'cruise-workflow',
    name: 'Cruise Trip Workflow',
    tier: 2,
    persona: PERSONAS.cruiseSpecialist,
    task: `Create a complete Royal Caribbean cruise proposal:
1. 7-night Western Caribbean from Miami
2. Ship: Wonder of the Seas
3. Include port stops: Cozumel, Costa Maya, Roatan
4. Add 2 shore excursions per port (use your creativity)
5. Include pre-cruise hotel in Miami
6. Add 3 pricing tiers

Make this proposal client-ready.`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'Trip created with cruise data',
        'Itinerary includes port stops',
        'Shore excursions were added',
        'Pre-cruise lodging included',
        'Pricing tiers added'
      ],
      bonus: [
        'Excursions are realistic for each port',
        'Data structure matches expected schema'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'multi-destination',
    name: 'Multi-Destination Land Trip',
    tier: 2,
    persona: PERSONAS.experiencedAgent,
    task: `Create a 14-day Europe tour hitting multiple cities:
- Paris (3 nights)
- Swiss Alps (2 nights)
- Venice (2 nights)
- Rome (3 nights)
- Florence (2 nights)

Include transportation between cities, key activities, and lodging for each stop.`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'Trip covers all 5 destinations',
        'Lodging array has entries for each city',
        'Itinerary spans 14 days',
        'Transportation mentioned'
      ],
      bonus: [
        'Activities are appropriate for each city',
        'Logical routing between destinations'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'client-comments',
    name: 'Client Comment Handling',
    tier: 2,
    persona: PERSONAS.experiencedAgent,
    context: 'A client named "Jennifer Martinez" has left comments on your "Alaska Cruise" trip proposal',
    task: `Handle client feedback on your Alaska Cruise:
1. Check for any new comments on the trip
2. Read the comments carefully
3. Reply to acknowledge the feedback
4. Make any necessary changes to the trip based on feedback
5. Dismiss the comments once addressed

Be professional and attentive.`,
    maxTurns: 12,
    successCriteria: {
      required: [
        'get_comments or get_all_comments was called',
        'Comments were read and understood',
        'Reply was sent via reply_to_comment',
        'dismiss_comments was called'
      ],
      bonus: [
        'Trip was updated based on feedback',
        'Reply was professional and helpful'
      ]
    },
    restrictedTools: ['publish_trip']
  }
];

// =============================================================================
// TIER 3: EDGE CASES
// =============================================================================

const EDGE_CASE_SCENARIOS: TestScenario[] = [
  {
    id: 'confused-user',
    name: 'Confused User Navigation',
    tier: 3,
    persona: PERSONAS.confusedUser,
    task: `You're confused about how to use this system.
Act naturally confused:
- Use wrong terms ("vacation thingy" instead of "trip")
- Ask vague questions ("how do I do the thing?")
- Misunderstand instructions sometimes
- Eventually try to create a simple "trip to Disney"

See if the system can guide you successfully.`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'System provided helpful guidance',
        'User eventually understood how to proceed',
        'Some trip-related action was taken'
      ],
      bonus: [
        'System was patient with confusion',
        'Clear explanations were given',
        'Trip was successfully created despite confusion'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'error-recovery',
    name: 'Error Recovery',
    tier: 3,
    persona: PERSONAS.experiencedAgent,
    task: `Test error handling by intentionally making mistakes:
1. Try to read a trip that doesn't exist ("nonexistent-trip-xyz")
2. Try to save a trip with missing required fields
3. Try to patch a trip with invalid data
4. Handle each error gracefully and retry correctly

Document what error messages you receive.`,
    maxTurns: 12,
    successCriteria: {
      required: [
        'Attempted to read non-existent trip',
        'Received appropriate error message',
        'Recovered from error gracefully',
        'Successfully completed a valid operation'
      ],
      bonus: [
        'Error messages were clear and actionable',
        'Recovery was smooth'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'support-escalation',
    name: 'Support Request Escalation',
    tier: 3,
    persona: PERSONAS.newAgent,
    task: `You need help with something outside normal trip planning:
1. Start by asking about subscription/billing questions
2. Ask how to upgrade your account
3. Eventually submit a support request

Test the support escalation flow.`,
    maxTurns: 10,
    successCriteria: {
      required: [
        'Billing/subscription question was asked',
        'System guided toward support flow',
        'submit_support or log_support_intent was called'
      ],
      bonus: [
        'Support request was properly submitted',
        'User received confirmation'
      ]
    },
    restrictedTools: ['publish_trip']
  }
];

// =============================================================================
// TIER 4: REALISTIC USER SCENARIOS - Real people, authentic situations
// =============================================================================

const REALISTIC_SCENARIOS: TestScenario[] = [
  {
    id: 'disney-busy-mom',
    name: 'Busy Mom Plans Disney',
    tier: 2,
    persona: PERSONAS.busyMom,
    task: `You're Michelle, a working nurse and mom of 3 trying to plan your family's first Disney World trip.

Your situation:
- Kids are 5, 8, and 11 years old
- Spring break is March 15-22
- Budget is $5000 max including flights from Chicago
- Your 8-year-old is obsessed with Star Wars, 5-year-old loves princesses
- You're typing this on your phone during lunch break

How you behave:
- Get distracted - ask a question then say "sorry, had to help a patient, where were we?"
- Ask practical mom questions: "is there food my picky eater will eat?" "how much walking?"
- Worry about budget constantly
- Type in fragments sometimes
- Get excited when you find something the kids will love

Start by saying hi and explaining you need help planning Disney for spring break with your 3 kids.`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'System engaged helpfully with fragmented communication',
        'Trip was created or started',
        'Budget considerations were addressed',
        'Kid-appropriate suggestions were made'
      ],
      bonus: [
        'System showed patience with interruptions',
        'Practical family travel tips were given',
        'Pricing estimates provided'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'retiree-alaska-cruise',
    name: 'Retirees Plan Alaska Dream Trip',
    tier: 2,
    persona: PERSONAS.retirees,
    task: `You're Barbara, typing while Jim looks over your shoulder. You've saved for 10 years for this Alaska cruise.

Your situation:
- Both 68 years old, retired
- Jim has bad knee - needs accessible cabin and excursions
- Your 45th anniversary is June 15 - want to celebrate on the trip
- Never cruised before, lots of questions
- Budget: saved $12,000, willing to spend it but don't want to waste money

How you behave:
- Ask lots of questions before committing to anything
- Jim interjects: (add things like "Jim says to ask about...")
- Worried about technology on the ship
- Want to know exactly what's included
- Get emotional about this being a "bucket list" trip
- Ask about travel insurance (at your age!)

Start by explaining this is your retirement dream trip to Alaska and you have lots of questions.`,
    maxTurns: 18,
    successCriteria: {
      required: [
        'Accessibility concerns were addressed',
        'Anniversary celebration acknowledged',
        'Questions were answered patiently',
        'Cruise trip was created or discussed'
      ],
      bonus: [
        'Travel insurance mentioned',
        'Mobility-friendly excursions suggested',
        'System handled "Jim says" interjections naturally'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'destination-wedding',
    name: 'Millennial Plans Destination Wedding',
    tier: 2,
    persona: PERSONAS.millennialBride,
    task: `You're Aisha, planning your Tulum destination wedding for 45 guests.

Your situation:
- Wedding date: February 14, 2026 (yes, Valentine's Day, I know it's cliche)
- 45 guests flying from NYC, Atlanta, Chicago, and LA
- Need hotel room block
- Want welcome party night before, farewell brunch day after
- Aesthetic: boho beach, lots of macramé and pampas grass
- Budget for guests: trying to keep it under $3500/couple including flights

How you behave:
- Very organized, reference "my spreadsheet" a lot
- Mention Pinterest inspiration
- Stress about coordinating everyone ("my aunt already bought the wrong flights")
- Switch between bride excitement and coordinator stress
- Ask about group booking discounts
- Want things to be Instagram-worthy

Start by introducing yourself as planning a destination wedding and needing help with the logistics.`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'Wedding trip structure was created',
        'Multiple events (ceremony, welcome party, brunch) addressed',
        'Group coordination was discussed',
        'Budget per couple was considered'
      ],
      bonus: [
        'System understood destination wedding complexity',
        'Suggested group hotel block approach',
        'Handled aesthetic preferences appropriately'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'business-plus-leisure',
    name: 'Business Traveler Adds Personal Days',
    tier: 2,
    persona: PERSONAS.businessTraveler,
    task: `You're Kevin, VP of Sales. Conference in Singapore, adding personal days to see Vietnam.

Your situation:
- Conference: March 10-12 in Singapore (already booked by company)
- Want to fly to Ho Chi Minh City March 12 evening after conference
- College buddy Mike lives there, wants to show you around
- Flying home March 16
- Company pays Singapore, you pay Vietnam extension
- Marriott Bonvoy Platinum - want points/status where possible

How you behave:
- Direct and efficient - bullet points
- Know airports and lounges, mention specific ones
- Get more relaxed when talking about the Vietnam fun part
- Ask about business class upgrade availability
- Want "one really good dinner" in each city
- Time is money - don't waste my time with fluff

Start with a brief, direct message about needing to plan a Vietnam side trip after your Singapore conference.`,
    maxTurns: 12,
    successCriteria: {
      required: [
        'Multi-leg trip was structured correctly',
        'Business vs personal distinction understood',
        'Hotel preferences/loyalty acknowledged',
        'Trip was created with correct dates'
      ],
      bonus: [
        'System matched direct communication style',
        'Fine dining suggestions included',
        'Efficient, no-fluff responses'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'gap-year-backpacker',
    name: 'Budget Backpacker Plans Gap Year',
    tier: 2,
    persona: PERSONAS.budgetBackpacker,
    task: `You're Tyler, 24, about to backpack Southeast Asia for 6 weeks before med school.

Your situation:
- Saved $8000 including flights from San Francisco
- 6 weeks: mid-January to end of February
- Must see: Thailand, Vietnam, Cambodia
- Maybe: Laos, Malaysia if budget allows
- Want hostels, overnight buses, street food
- First big solo trip - nervous but won't admit it

How you behave:
- Enthusiastic about "authentic" experiences
- Hate tourist traps, want "where locals go"
- Ask about hostel recommendations
- Use backpacker slang: "banana pancake trail", "full moon party"
- Flexible on everything except budget
- Ask about meeting other travelers
- Low-key worried about safety but play it cool

Start by saying you're planning your gap year trip to Southeast Asia and want to stretch $8000 as far as possible.`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'Budget-conscious options were provided',
        'Multi-country itinerary created',
        'Backpacker-style travel acknowledged',
        'Trip was created or outlined'
      ],
      bonus: [
        'Authentic/local experiences mentioned',
        'Hostel or budget accommodation discussed',
        'System understood backpacker culture references'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'surprise-anniversary',
    name: 'Husband Plans Surprise Anniversary Trip',
    tier: 3,
    persona: PERSONAS.anniversarySurprise,
    task: `You're David, planning a SURPRISE 25th anniversary trip for your wife Catherine.

Your situation:
- Anniversary: October 18
- She thinks you're just doing dinner at your usual restaurant
- 4-5 days, she can't take more time off
- She loves: wine, cooking classes, spa days
- She hates: flying more than 6 hours, crowded tourist spots
- She's vegetarian (not vegan)
- You've never planned a trip - she always does it

How you behave:
- Paranoid about her finding out - ask if there's a way to hide this
- Overthink every detail ("would she prefer a king bed or two queens?")
- Keep saying "she always plans everything, I want to do this right"
- Get emotional about wanting it to be perfect
- Ask for vegetarian fine dining specifically
- Consider hot air balloon but worry she might be scared

Start by whispering (typing in lowercase?) that you need help planning a SURPRISE trip and she can't find out.`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'Surprise nature of trip was acknowledged',
        'Wife preferences were incorporated',
        'Wine country destination was considered',
        'Trip was created or started'
      ],
      bonus: [
        'System handled the emotional/sweet nature appropriately',
        'Vegetarian dining specifically addressed',
        'Privacy concerns acknowledged'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'family-reunion-chaos',
    name: 'Family Reunion Coordinator',
    tier: 3,
    persona: PERSONAS.familyReunion,
    task: `You're Denise, organizing the Washington family reunion for 32 people.

Your situation:
- 32 people, ages 3 to 87
- Great-grandma Ruby (87) uses wheelchair
- 4 toddlers under 5
- Mix of budgets - some family members struggling financially
- Looking at beach house OR all-inclusive resort
- 5 nights in July
- Target: under $300/person (but Grandma Ruby's is covered by the family fund)
- Family spread across 6 states

How you behave:
- Keep referencing your spreadsheet of everyone's needs
- Mention dietary restrictions: "Cousin Marcus is vegan, Aunt Linda is gluten-free"
- Stress about pleasing everyone
- Ask about accessibility A LOT
- Worry about activities for such different ages
- Get overwhelmed and need to be talked through options
- Mention this is the first reunion since Uncle Jerome passed

Start by explaining you're organizing a family reunion and "I have a spreadsheet but I'm overwhelmed."`,
    maxTurns: 18,
    successCriteria: {
      required: [
        'Large group logistics were addressed',
        'Accessibility requirements acknowledged',
        'Multi-generational needs considered',
        'Some trip option was created or discussed'
      ],
      bonus: [
        'Dietary restrictions mentioned in response',
        'System showed patience with complexity',
        'Budget per person was tracked'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'solo-female-traveler',
    name: 'First Solo Trip After Divorce',
    tier: 3,
    persona: PERSONAS.soloFemale,
    task: `You're Priya, a software engineer taking your first solo trip after your divorce.

Your situation:
- 2 weeks in Portugal, late September
- First time traveling alone internationally
- Budget: $4000 not including flights (already booked to Lisbon)
- Want: cooking classes, wine tasting, maybe a day trip to Sintra
- Nervous about solo female safety but determined
- Interested in meeting other travelers but not party hostels

How you behave:
- Ask lots of safety questions ("is this neighborhood safe at night?")
- Research everything - "I read on TripAdvisor..."
- Oscillate between nervous and determined
- Want meaningful experiences not just Instagram photos
- Ask about cooking classes specifically - you want to learn pastéis de nata
- Wonder if you should do a group tour for some parts
- Get a little emotional about this being "your new chapter"

Start by introducing yourself and saying this is your first solo trip and you're "nervous but excited."`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'Safety concerns were addressed thoughtfully',
        'Solo-friendly activities suggested',
        'Portugal trip was created or outlined',
        'Cooking class interest acknowledged'
      ],
      bonus: [
        'Neighborhood safety was discussed',
        'System was encouraging about solo travel',
        'Mix of structured and free time suggested'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'last-minute-panic',
    name: 'Forgot Parents Anniversary',
    tier: 3,
    persona: PERSONAS.lastMinuteChaos,
    task: `You're Brandon, and you just realized your parents' 40th anniversary is in 2 weeks. Your sister is FURIOUS.

Your situation:
- Anniversary: 2 weeks from now
- Parents are early 70s, relatively active
- You have no idea what they like - need to text mom for details
- Sister keeps texting angry messages
- Budget: doesn't matter at this point, you're in the doghouse
- You live in Seattle, parents in Phoenix

How you behave:
- Panicked, lots of "oh god" and "I can't believe I forgot"
- Make quick decisions then immediately second-guess them
- Keep saying "let me text my mom" and come back with random details
- Get distracted by angry sister texts: "My sister just texted that I'm 'unbelievable'"
- Throw money at the problem
- Need hand-holding through the whole process

Start by saying "I need help URGENTLY - I forgot my parents' 40th anniversary is in 2 weeks and my sister is going to kill me."`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'Urgency was acknowledged',
        'System helped despite incomplete information',
        'Some trip option was suggested quickly',
        'Trip was created or started'
      ],
      bonus: [
        'System showed patience with panic',
        'Helped gather needed details',
        'Quick timeline was respected'
      ]
    },
    restrictedTools: ['publish_trip']
  },

  {
    id: 'group-trip-drama',
    name: 'Girls Trip Group Coordinator',
    tier: 3,
    persona: PERSONAS.groupOrganizer,
    task: `You're Stephanie, trying to plan a Nashville girls trip for your best friend's 30th. 8 women, 8 opinions.

Your situation:
- Best friend Emma turns 30
- 8 women total, 3 nights in Nashville
- Some want rooftop bars and Instagram spots
- Others want dive bars and honky-tonks
- Budgets range from "I'm broke" to "money's not an issue"
- You're the unofficial planner and it's stressing you out
- Group chat is blowing up with conflicting opinions

How you behave:
- Frustrated but trying to keep it together
- Quote contradicting texts: "Sarah wants a fancy dinner, but Jen says she can't afford more than $30"
- Ask about options for different budget levels
- Wonder aloud if you should just book something and tell everyone to deal with it
- Vent a little: "I love Emma but I'm never doing this again"
- Need help figuring out how to make everyone happy

Start by saying "I'm trying to plan my best friend's 30th birthday trip to Nashville and I have 8 women who all want different things. HELP."`,
    maxTurns: 15,
    successCriteria: {
      required: [
        'Group dynamics were acknowledged',
        'Mixed budget considerations discussed',
        'Nashville trip was created or outlined',
        'Activity variety was suggested'
      ],
      bonus: [
        'System helped with group compromise strategies',
        'Different budget tiers suggested',
        'System showed empathy for coordinator stress'
      ]
    },
    restrictedTools: ['publish_trip']
  }
];

// =============================================================================
// EXPORTS
// =============================================================================

export const ALL_SCENARIOS = [
  ...CORE_SCENARIOS,
  ...FEATURE_SCENARIOS,
  ...EDGE_CASE_SCENARIOS,
  ...REALISTIC_SCENARIOS
];

export const SCENARIOS_BY_TIER: Record<number, TestScenario[]> = {
  1: CORE_SCENARIOS,
  2: FEATURE_SCENARIOS,
  3: EDGE_CASE_SCENARIOS,
  4: REALISTIC_SCENARIOS
};

export const SCENARIOS_BY_ID = Object.fromEntries(
  ALL_SCENARIOS.map(s => [s.id, s])
);

export function getScenario(id: string): TestScenario | undefined {
  return SCENARIOS_BY_ID[id];
}

export function getScenariosByTier(tier: 1 | 2 | 3 | 4): TestScenario[] {
  return SCENARIOS_BY_TIER[tier] || [];
}

export function getCoreScenarios(): TestScenario[] {
  return CORE_SCENARIOS;
}
