/**
 * Prompt Templates for AI Icebreaker Generation
 * US-051: AI icebreaker message generation
 */

export const PROMPT_VERSION = 'v1.0.0';

export const ICEBREAKER_GENERATION_PROMPT = `You are a professional networking expert helping craft personalized outreach messages.

CONTACT CONTEXT:
- Name: {{contactName}}
- Current Role: {{currentTitle}} at {{currentCompany}}
- Relationship History: {{relationshipSummary}}
- Last Interaction: {{lastInteractionDate}}
- Trigger Event: {{triggerEvent}}
- Mutual Connections: {{mutualConnections}}

USER CONTEXT:
- Your Name: {{userName}}
- Your Role: {{userTitle}}
- Your Writing Style: {{writingStyleProfile}}

TASK:
Generate a {{channel}} message with a {{tone}} tone that:
1. References the trigger event naturally
2. Provides clear value proposition
3. Includes a soft call-to-action
4. Feels authentic and personalized
5. Is under {{wordLimit}} words

CONSTRAINTS:
- No generic templates
- Avoid overly salesy language
- Match the specified tone exactly
- Respect professional boundaries

OUTPUT FORMAT (JSON):
{
  "variations": [
    {
      "subject": "Email subject line (only if channel is email, otherwise omit)",
      "body": "The main message content",
      "talkingPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "reasoning": "Brief explanation of approach taken"
    },
    {
      "subject": "Alternative subject (only if channel is email)",
      "body": "Alternative message content",
      "talkingPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "reasoning": "Brief explanation of approach taken"
    },
    {
      "subject": "Third alternative subject (only if channel is email)",
      "body": "Third alternative message content",
      "talkingPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "reasoning": "Brief explanation of approach taken"
    }
  ]
}

IMPORTANT: Generate exactly 3 variations with different approaches but all meeting the requirements.`;

export const TONE_GUIDELINES: Record<string, string> = {
  professional: `
    - Use formal language and proper business etiquette
    - Address recipient with appropriate title
    - Focus on professional value and mutual benefit
    - Avoid casual expressions and slang
    - Maintain professional distance
  `,
  friendly: `
    - Use warm, approachable language
    - Balance professionalism with personal connection
    - Show genuine interest in the person
    - Use conversational tone without being too casual
    - Reference shared experiences or connections naturally
  `,
  casual: `
    - Use relaxed, conversational language
    - Keep it brief and to the point
    - Use contractions and informal expressions
    - Be authentic and personable
    - Focus on building rapport
  `,
};

export const CHANNEL_GUIDELINES: Record<string, string> = {
  email: `
    - Include a compelling subject line
    - Use proper email formatting
    - Keep paragraphs short (2-3 sentences)
    - Include a clear signature line placeholder
    - Professional greeting and closing
  `,
  linkedin: `
    - No subject line needed
    - Start with a brief, engaging opener
    - Keep total length to 300 characters or less
    - Mention LinkedIn-specific context if relevant
    - Encourage connection or response
  `,
  whatsapp: `
    - No subject line needed
    - Very brief and conversational
    - Use short sentences and paragraphs
    - Can use light emoji if appropriate for tone
    - Direct and to-the-point
  `,
};

export interface PromptVariables {
  contactName: string;
  currentTitle?: string;
  currentCompany?: string;
  relationshipSummary?: string;
  lastInteractionDate?: string;
  triggerEvent?: string;
  mutualConnections?: string;
  userName: string;
  userTitle?: string;
  writingStyleProfile?: string;
  channel: string;
  tone: string;
  wordLimit: number;
}

export function buildPrompt(variables: PromptVariables): string {
  let prompt = ICEBREAKER_GENERATION_PROMPT;

  // Replace all template variables
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    const replacement = value ?? 'Not specified';
    prompt = prompt.replace(new RegExp(placeholder, 'g'), String(replacement));
  });

  // Add tone guidelines
  const toneGuideline = TONE_GUIDELINES[variables.tone] ?? '';
  prompt += `\n\nTONE GUIDELINES:${toneGuideline}`;

  // Add channel guidelines
  const channelGuideline = CHANNEL_GUIDELINES[variables.channel] ?? '';
  prompt += `\n\nCHANNEL GUIDELINES:${channelGuideline}`;

  return prompt;
}



