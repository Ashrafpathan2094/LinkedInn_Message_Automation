const fs = require("fs");

const ERROR_PROFILES = new Set([
  "https://www.linkedin.com/in/nidhi-gupta-81184a259",
  "https://www.linkedin.com/in/amy-mariya-roy-8bb081244",
  "https://www.linkedin.com/in/anjali-bhosale-b1251927a",
  "https://www.linkedin.com/in/anshika-anshika-330b74323",
  "https://www.linkedin.com/in/shradha-darode-594a651b7",
  "https://www.linkedin.com/in/garvita-sharma-616195292",
  "https://www.linkedin.com/in/radhikagadve",
  "https://www.linkedin.com/in/gunika-arora-658995247",
  "https://www.linkedin.com/in/milee-majithiya-608474289",
  "https://www.linkedin.com/in/shweta-yadav-41a004261",
  "https://www.linkedin.com/in/tisha-124aa1256",
  "https://www.linkedin.com/in/priyanka-bhowmick-b06196249",
  "https://www.linkedin.com/in/divyadharshana5",
  "https://www.linkedin.com/in/achalpatel04",
  "https://www.linkedin.com/in/archi-goel-81a7a52a0",
  "https://www.linkedin.com/in/nikitabansode",
  "https://www.linkedin.com/in/swati-jadhav-677994281",
  "https://www.linkedin.com/in/vivek-kyada-33067630b",
  "https://www.linkedin.com/in/neha-kashyap-7023741b0",
  "https://www.linkedin.com/in/poonam-mohite",
  "https://www.linkedin.com/in/tanya-srivastava-33a438254",
  "https://www.linkedin.com/in/abhishek-umtekar",
  "https://www.linkedin.com/in/radhika-gopinathan-a44008224",
  "https://www.linkedin.com/in/arpita-maurya-36840a354",
  "https://www.linkedin.com/in/anjali-thakur-833796227",
  "https://www.linkedin.com/in/bidisha-biswas-",
  "https://www.linkedin.com/in/dr-zainab-mirza",
  "https://www.linkedin.com/in/ankit-kumar-sharma-62b185330",
  "https://www.linkedin.com/in/divyagaonkar22",
  "https://www.linkedin.com/in/priyanka-dayal-39071a194",
  "https://www.linkedin.com/in/deeksha-badhwars",
  "https://www.linkedin.com/in/sakshi-pawar-44b454258",
  "https://www.linkedin.com/in/harika-gedala-579720207",
  "https://www.linkedin.com/in/diksha-dadwal-a60b91211",
  "https://www.linkedin.com/in/tanu-sharma-4b6a2a278",
  "https://www.linkedin.com/in/akansha-luckwal-118876220",
  "https://www.linkedin.com/in/aastha-yadav-a93a18280",
  "https://www.linkedin.com/in/rutuja-fand-411142282",
  "https://www.linkedin.com/in/apurva-bobade",
  "https://www.linkedin.com/in/shreye-chatterjee-42b408240",
  "https://www.linkedin.com/in/ashishpandeya1",
  "https://www.linkedin.com/in/amukthagattlaramagiri",
  "https://www.linkedin.com/in/prajakta-nalawade18",
  "https://www.linkedin.com/in/ss-a8713b272",
  "https://www.linkedin.com/in/somi-zakir-281b0020a",
  "https://www.linkedin.com/in/avipsa-ghosh-2053b528a",
  "https://www.linkedin.com/in/satinder-kaur-bamrah-6b3a9926b",
  "https://www.linkedin.com/in/priya-bhangude-024aa1281",
  "https://www.linkedin.com/in/shravani-kapse",
  "https://www.linkedin.com/in/sneha-jadhav-er",
  "https://www.linkedin.com/in/latika-adhikari-244b79214/en",
  "https://www.linkedin.com/in/hema-latha-m-934653256",
  "https://www.linkedin.com/in/shivali-dhiman-a16006201",
  "https://www.linkedin.com/in/aastha-dixit-958065210",
  "https://www.linkedin.com/in/kumari-mahi",
  "https://www.linkedin.com/in/nisha-pandey-10b819169",
  "https://www.linkedin.com/in/sasha-alexandrov",
  "https://www.linkedin.com/in/teesha-malkani-352735285",
  "https://www.linkedin.com/in/shreya-bag-93642b28b",
  "https://www.linkedin.com/in/rakhi-garhwal-167b00338",
  "https://www.linkedin.com/in/shifa-mohammad-khurshid-2832492b0",
  "https://www.linkedin.com/in/priya-mankar-b63a73257",
  "https://www.linkedin.com/in/sakshi-khandelwal-9568a0214",
  "https://www.linkedin.com/in/suhani-hirpara-6103b7279",
  "https://www.linkedin.com/in/pallvi-goyal2233355555",
  "https://www.linkedin.com/in/syeda-saima-biyabani-8b0428270",
  "https://www.linkedin.com/in/jaanvi-choudhary-9277872a3",
  "https://www.linkedin.com/in/bhawnakaushik",
  "https://www.linkedin.com/in/nandini-puthramaddi",
  "https://www.linkedin.com/in/sreeparna-naskar",
  "https://www.linkedin.com/in/anshika-pandey-693856306",
  "https://www.linkedin.com/in/gaurangityagi",
  "https://www.linkedin.com/in/shaikhbasheeraafroz09",
  "https://www.linkedin.com/in/shirley-getsy-john-ebenezer-02a1631b7",
  "https://www.linkedin.com/in/sakshi-bansal-b1b777282",
  "https://www.linkedin.com/in/siddhi-sutar-905a99284"
]);

const filePath = "./messaged_users.json";

const users = JSON.parse(fs.readFileSync(filePath, "utf8"));

const originalCount = users.length;

const filteredUsers = users.filter(
  user => !ERROR_PROFILES.has(user.profileUrl)
);

fs.writeFileSync(
  filePath,
  JSON.stringify(filteredUsers, null, 2),
  "utf8"
);

console.log(`Removed ${originalCount - filteredUsers.length} users.`);
console.log(`Remaining users: ${filteredUsers.length}`);