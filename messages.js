// messages.js

// ─── Config (defaults) ───────────────────────────────────────────────────────
// These are fallback values used only if buildMessage() is called without
// overrides. You can still call buildMessage(name, { ... }) per-message to
// change/omit any of these.

const DEFAULTS = {
  resumeLink: "https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view",
  role: "Full Stack Developer",
  portfolioLink: "https://ashraf-khan-portfolio.vercel.app", // e.g. "https://ashraf-khan-portfolio.vercel.app"
  experience: "3.5+ years",    // e.g. "3.5+ years"
  availability: "immediate joiner",  // e.g. "immediate joiner"
};

// ─── Templates ───────────────────────────────────────────────────────────────
// Templates only ever reference {firstName}, {role}, {companyLine}, and
// {detailsBlock}. detailsBlock is a dynamically assembled block of optional
// lines (resume / portfolio / experience / availability) — see below.

const MESSAGE_TEMPLATES = [
  `Hi {firstName},
Hope you're doing well! I'm actively exploring {role} roles right now. {companyLine}
{detailsBlock}
Thanks a lot!`,

  `Hey {firstName},
Hope all's well! I'm currently on the lookout for {role} opportunities. {companyLine}
{detailsBlock}
Really appreciate it!`,

  `Hi {firstName},
I hope you're having a great day! I'm currently seeking {role} positions. {companyLine}
{detailsBlock}
Thank you so much!`,

  `Hello {firstName},
Hope things are going well for you! I'm currently looking for {role} roles. {companyLine}
{detailsBlock}
Thanks in advance!`,

  `Hi {firstName},
I hope this message finds you well. I'm currently exploring {role} opportunities in the market. {companyLine}
{detailsBlock}
Thank you!`,

  `Hey {firstName},
Hope you're doing great! I wanted to reach out as I'm currently looking for {role} openings. {companyLine}
{detailsBlock}
Really appreciate any help!`,

  `Hi {firstName},
Hope everything's going well on your end! I'm on the job hunt for {role} roles at the moment. {companyLine}
{detailsBlock}
Thanks a ton!`,

  `Hello {firstName},
I hope you're doing well! I'm currently open to {role} opportunities. {companyLine}
{detailsBlock}
Thank you for your time!`,

  `Hi {firstName},
Hope your week is going well! I'm currently in the process of looking for {role} positions. {companyLine}
{detailsBlock}
Thanks so much!`,

  `Hey {firstName},
Hope you're well! I'm currently seeking new {role} opportunities. {companyLine}
{detailsBlock}
Thanks a lot for your help!`,

  `Hi {firstName},
I hope things are great with you! I'm currently exploring new {role} roles. {companyLine}
{detailsBlock}
Thank you so much for considering!`,

  `Hello {firstName},
Hope you're having a wonderful day! I'm actively looking for {role} opportunities. {companyLine}
{detailsBlock}
Thanks, I really appreciate it!`,

  `Hi {firstName},
Hope all is well! I'm currently in search of {role} roles and thought I'd reach out. {companyLine}
{detailsBlock}
Thank you for your time and help!`,

  `Hey {firstName},
Hope you're doing fantastic! I'm currently looking at {role} opportunities in the industry. {companyLine}
{detailsBlock}
Thanks a lot!`,

  `Hi {firstName},
I hope this finds you in good spirits! I'm currently on the lookout for {role} positions. {companyLine}
{detailsBlock}
Thank you!`,

  `Hello {firstName},
Hope you're doing well! I wanted to connect as I'm currently looking for {role} opportunities. {companyLine}
{detailsBlock}
Would really appreciate your support. Thanks!`,

  `Hi {firstName},
Hope things are great! I'm currently exploring {role} openings and would love any guidance. {companyLine}
{detailsBlock}
Thank you so much!`,

  `Hey {firstName},
Hope you're having a good one! I'm actively looking for {role} roles right now. {companyLine}
{detailsBlock}
Thanks in advance, really appreciate it!`,

  `Hi {firstName},
I hope you're doing well! I'm currently searching for {role} opportunities. {companyLine}
{detailsBlock}
Many thanks!`,

  `Hello {firstName},
Hope all's going well with you! I'm on the market for {role} positions at the moment. {companyLine}
{detailsBlock}
Thank you for any help!`,

  `Hi {firstName},
Hope you're keeping well! I'm currently open to {role} roles. {companyLine}
{detailsBlock}
I'd really appreciate a referral if possible. Thanks!`,

  `Hey {firstName},
Hope life's treating you well! I'm in the middle of a job search for {role} positions. {companyLine}
{detailsBlock}
Thanks so much for your time!`,

  `Hi {firstName},
I hope you're doing great! I'm actively searching for {role} opportunities and thought of reaching out. {companyLine}
{detailsBlock}
Thank you, I really appreciate it!`,

  `Hello {firstName},
Hope everything's well! I'm currently pursuing {role} opportunities in the tech space. {companyLine}
{detailsBlock}
Thanks a lot for your consideration!`,

  `Hi {firstName},
Hope you're doing well! I'm currently looking to transition into a new {role} role. {companyLine}
{detailsBlock}
Would be grateful for any help. Thank you!`,
];

const COMPANY_LINES = {
  withCompany: [
    `If there are any suitable openings at {company}, I'd really appreciate a referral.`,
    `Should there be any relevant openings at {company}, a referral from you would mean a lot.`,
    `If {company} has any openings that match my profile, I'd be grateful for a referral.`,
    `In case there are any fitting roles at {company}, I'd love it if you could refer me.`,
    `If you know of any relevant positions at {company}, a referral would be hugely appreciated.`,
    `Should {company} have any suitable openings, I'd be thankful if you could put in a word.`,
    `If there happen to be any open roles at {company} that fit my background, a referral would be amazing.`,
  ],
  withoutCompany: [
    `If there are any suitable openings at your company, I'd really appreciate a referral.`,
    `Should there be any relevant openings at your organization, a referral from you would mean a lot.`,
    `If your company has any openings that match my profile, I'd be grateful for a referral.`,
    `In case there are any fitting roles at your workplace, I'd love it if you could refer me.`,
    `If you know of any relevant positions, a referral would be hugely appreciated.`,
    `Should your company have any suitable openings, I'd be thankful if you could put in a word.`,
    `If there happen to be any open roles that fit my background, a referral would be amazing.`,
  ],
};

// ─── Optional detail-line phrasing variants ─────────────────────────────────
// Each of these is only used if the corresponding value is provided.
// Multiple phrasing options per field keep messages from feeling templated.

const EXPERIENCE_LINES = [
  `I have {experience} of experience in this field.`,
  `I bring {experience} of hands-on experience to the table.`,
  `I've been working in this space for {experience}.`,
  `I currently have {experience} of relevant experience.`,
];

const AVAILABILITY_LINES = [
  `I'm an {availability} and can start right away.`,
  `I'm available as an {availability}.`,
  `I can join immediately — I'm an {availability}.`,
  `Just a quick note — I'm an {availability}.`,
];

const PORTFOLIO_LINES = [
  `You can check out my portfolio here: {portfolioLink}`,
  `Here's my portfolio for reference: {portfolioLink}`,
  `My portfolio: {portfolioLink}`,
  `Feel free to take a look at my portfolio: {portfolioLink}`,
];

const RESUME_LINES = [
  `Here's my resume if it helps: {resumeLink}`,
  `Sharing my resume here: {resumeLink}`,
  `You can find my resume here: {resumeLink}`,
  `Here's a link to my resume: {resumeLink}`,
  `My resume is here for your reference: {resumeLink}`,
  `Attaching my resume link here: {resumeLink}`,
  `Please find my resume here: {resumeLink}`,
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Builds the block of optional detail lines (experience, availability,
 * resume, portfolio) based on whichever values were actually provided.
 * Any field left out is simply skipped — no blank lines, no placeholder text.
 */
function buildDetailsBlock({ resumeLink, portfolioLink, experience, availability }) {
  const lines = [];

  if (experience) {
    lines.push(pickRandom(EXPERIENCE_LINES).replace("{experience}", experience));
  }

  if (availability) {
    lines.push(pickRandom(AVAILABILITY_LINES).replace("{availability}", availability));
  }

  if (resumeLink) {
    lines.push(pickRandom(RESUME_LINES).replace("{resumeLink}", resumeLink));
  }

  if (portfolioLink) {
    lines.push(pickRandom(PORTFOLIO_LINES).replace("{portfolioLink}", portfolioLink));
  }

  return lines.join("\n");
}

/**
 * Removes the {detailsBlock} placeholder cleanly if it ends up empty,
 * collapsing any resulting double blank lines.
 */
function injectDetailsBlock(template, detailsBlock) {
  if (!detailsBlock) {
    // Remove the placeholder line entirely (including its newline)
    return template.replace(/\n?{detailsBlock}\n?/g, "\n");
  }
  return template.replace("{detailsBlock}", detailsBlock);
}

/**
 * Collapses 3+ newlines down to 2 (i.e. no more than one blank line),
 * and trims stray leading/trailing whitespace per line block.
 */
function cleanupSpacing(message) {
  return message.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * @param {string} name - full name of the recipient
 * @param {object} [options]
 * @param {string} [options.company] - recipient's company name
 * @param {string} [options.role] - role being targeted (defaults to DEFAULTS.role)
 * @param {string} [options.resumeLink] - resume URL (omit/empty to skip)
 * @param {string} [options.portfolioLink] - portfolio URL (omit/empty to skip)
 * @param {string} [options.experience] - e.g. "3.5+ years" (omit/empty to skip)
 * @param {string} [options.availability] - e.g. "immediate joiner" (omit/empty to skip)
 */
function buildMessage(name, options = {}) {
  const firstName = name.split(" ")[0];

  const {
    company,
    role = DEFAULTS.role,
    resumeLink = DEFAULTS.resumeLink,
    portfolioLink = DEFAULTS.portfolioLink,
    experience = DEFAULTS.experience,
    availability = DEFAULTS.availability,
  } = options;

  let companyLine;
  if (company) {
    companyLine = pickRandom(COMPANY_LINES.withCompany).replace("{company}", company);
  } else {
    companyLine = pickRandom(COMPANY_LINES.withoutCompany);
  }

  const detailsBlock = buildDetailsBlock({
    resumeLink,
    portfolioLink,
    experience,
    availability,
  });

  const template = pickRandom(MESSAGE_TEMPLATES);

  let message = template
    .replace("{firstName}", firstName)
    .replace("{companyLine}", companyLine)
    .replace("{role}", role);

  message = injectDetailsBlock(message, detailsBlock);
  message = cleanupSpacing(message);

  return message;
}

module.exports = { buildMessage };