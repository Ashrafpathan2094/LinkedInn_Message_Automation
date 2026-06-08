// messages.js

const MESSAGE_TEMPLATES = [
  `Hi {firstName},
Hope you're doing well! I'm actively exploring Full Stack Developer roles right now. {companyLine}
Here's my resume if it helps: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks a lot!`,

  `Hey {firstName},
Hope all's well! I'm currently on the lookout for Full Stack Developer opportunities. {companyLine}
Sharing my resume here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Really appreciate it!`,

  `Hi {firstName},
I hope you're having a great day! I'm currently seeking Full Stack Developer positions. {companyLine}
You can find my resume here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you so much!`,

  `Hello {firstName},
Hope things are going well for you! I'm currently looking for Full Stack Developer roles. {companyLine}
Here's a link to my resume: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks in advance!`,

  `Hi {firstName},
I hope this message finds you well. I'm currently exploring Full Stack Developer opportunities in the market. {companyLine}
My resume is here for your reference: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you!`,

  `Hey {firstName},
Hope you're doing great! I wanted to reach out as I'm currently looking for Full Stack Developer openings. {companyLine}
Here's my resume: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Really appreciate any help!`,

  `Hi {firstName},
Hope everything's going well on your end! I'm on the job hunt for Full Stack Developer roles at the moment. {companyLine}
Attaching my resume link here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks a ton!`,

  `Hello {firstName},
I hope you're doing well! I'm currently open to Full Stack Developer opportunities. {companyLine}
Please find my resume here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you for your time!`,

  `Hi {firstName},
Hope your week is going well! I'm currently in the process of looking for Full Stack Developer positions. {companyLine}
Here's my resume for your reference: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks so much!`,

  `Hey {firstName},
Hope you're well! I'm currently seeking new Full Stack Developer opportunities. {companyLine}
My resume can be found here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks a lot for your help!`,

  `Hi {firstName},
I hope things are great with you! I'm currently exploring new Full Stack Developer roles. {companyLine}
I've shared my resume here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you so much for considering!`,

  `Hello {firstName},
Hope you're having a wonderful day! I'm actively looking for Full Stack Developer opportunities. {companyLine}
Here's the link to my resume: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks, I really appreciate it!`,

  `Hi {firstName},
Hope all is well! I'm currently in search of Full Stack Developer roles and thought I'd reach out. {companyLine}
You can view my resume here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you for your time and help!`,

  `Hey {firstName},
Hope you're doing fantastic! I'm currently looking at Full Stack Developer opportunities in the industry. {companyLine}
Here's my resume link: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks a lot!`,

  `Hi {firstName},
I hope this finds you in good spirits! I'm currently on the lookout for Full Stack Developer positions. {companyLine}
Sharing my resume here for your convenience: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you!`,

  `Hello {firstName},
Hope you're doing well! I wanted to connect as I'm currently looking for Full Stack Developer opportunities. {companyLine}
My resume is available here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Would really appreciate your support. Thanks!`,

  `Hi {firstName},
Hope things are great! I'm currently exploring Full Stack Developer openings and would love any guidance. {companyLine}
Here's my resume: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you so much!`,

  `Hey {firstName},
Hope you're having a good one! I'm actively looking for Full Stack Developer roles right now. {companyLine}
Dropping my resume link here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks in advance, really appreciate it!`,

  `Hi {firstName},
I hope you're doing well! I'm currently searching for Full Stack Developer opportunities. {companyLine}
Here's my resume for your reference: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Many thanks!`,

  `Hello {firstName},
Hope all's going well with you! I'm on the market for Full Stack Developer positions at the moment. {companyLine}
You can find my resume at this link: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you for any help!`,

  `Hi {firstName},
Hope you're keeping well! I'm currently open to Full Stack Developer roles. {companyLine}
Here's my resume: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
I'd really appreciate a referral if possible. Thanks!`,

  `Hey {firstName},
Hope life's treating you well! I'm in the middle of a job search for Full Stack Developer positions. {companyLine}
My resume link: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks so much for your time!`,

  `Hi {firstName},
I hope you're doing great! I'm actively searching for Full Stack Developer opportunities and thought of reaching out. {companyLine}
Resume here: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you, I really appreciate it!`,

  `Hello {firstName},
Hope everything's well! I'm currently pursuing Full Stack Developer opportunities in the tech space. {companyLine}
Here's a link to my resume: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thanks a lot for your consideration!`,

  `Hi {firstName},
Hope you're doing well! I'm currently looking to transition into a new Full Stack Developer role. {companyLine}
Here's my resume: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
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

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildMessage(name, company) {
  const firstName = name.split(" ")[0];

  // Pick a random company line variant
  let companyLine;
  if (company) {
    companyLine = pickRandom(COMPANY_LINES.withCompany).replace(
      "{company}",
      company,
    );
  } else {
    companyLine = pickRandom(COMPANY_LINES.withoutCompany);
  }

  // Pick a random template and fill it in
  const template = pickRandom(MESSAGE_TEMPLATES);
  return template
    .replace("{firstName}", firstName)
    .replace("{companyLine}", companyLine);
}

module.exports = { buildMessage };
