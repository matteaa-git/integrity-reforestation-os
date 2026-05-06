import type { Employee } from "@/app/admin/page";
import { saveRecord } from "@/lib/adminDb";

function initials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function emp(
  id: string,
  name: string,
  role: string,
  department: string,
  email: string,
  phone: string,
  city: string,
  province: string,
  crewBoss: string,
  sin: string,
  dlClass: string,
  firstAid: string,
  emergencyContactName: string,
  emergencyContactPhone: string,
  emergencyContactEmail: string,
  bankName: string,
  bankInstitutionNumber: string,
  bankTransitNumber: string,
  bankAccountNumber: string,
  streetAddress: string,
): Employee {
  return {
    id,
    name,
    role,
    department,
    email,
    phone,
    status: "active",
    startDate: "2026-05-01",
    avatar: initials(name),
    city,
    province,
    crewBoss: crewBoss || undefined,
    sin: sin || undefined,
    dlClass: dlClass || undefined,
    firstAid: firstAid || undefined,
    emergencyContactName: emergencyContactName || undefined,
    emergencyContactPhone: emergencyContactPhone || undefined,
    emergencyContactEmail: emergencyContactEmail || undefined,
    bankName: bankName || undefined,
    bankInstitutionNumber: bankInstitutionNumber || undefined,
    bankTransitNumber: bankTransitNumber || undefined,
    bankAccountNumber: bankAccountNumber || undefined,
    streetAddress: streetAddress || undefined,
  };
}

export const EMPLOYEES_2026: Employee[] = [
  emp("s26-001","Charles Leblanc","Supervisor","Operations","chuck@integrity-reforestation.com","2898213866","Fonthill","ON","","547821344","","","Anne Leblanc","9053213212","anne@hotmail.com","Tangerine","123","","1234512345","1-1512 Pelham Street"),
  emp("s26-002","Scout Broughton","Tree Planter","Field Operations","scoutbroughton@gmail.com","7053733283","Orleans","ON","Jolissa Lonsberry","967090986","G","No","Julie Fortier","6138519975","mervyn.broughton@gmail.com","CIBC","010","00010","7827598","705 Schubert Circle"),
  emp("s26-003","Ema Regina Pablo-Fortier","Tree Planter","Field Operations","emapab@gmail.com","3435761873","Orleans","ON","Jolissa Lonsberry","293580320","G2","No","Julie Fortier","6138519975","pabfort@gmail.com","TD Bank","004","05636","6583101","705 Schubert Circle"),
  emp("s26-004","Caleb Gonsalves","Tree Planter","Field Operations","calebgonsalves222@gmail.com","5192173583","Wasaga Beach","ON","Jolissa Lonsberry","585531270","G2","No","Robyn Gonsalves","5192152769","Robynlee@rogers.com","CIBC","614","00152","4023094821","38 Knox Rd E"),
  emp("s26-005","Davente Schab","Tree Planter","Field Operations","davente563@gmail.com","6139798490","Ottawa","ON","Adam Deruyte","561872151","G2","No","Amanda Schab","6133234731","aschab.realestate@gmail.com","RBC","003","00155","5005020","10 James St"),
  emp("s26-006","Malcolm Cowley","Tree Planter","Field Operations","malcolmcowley005@gmail.com","2265682474","Southampton","ON","Richard Jackson Gattesco","549229573","G2","No","Vince Cowley","5193772474","vincecowley@gmail.com","Wealthsimple","703","00001","12002713","275 Blanchfield Road"),
  emp("s26-007","Gaetane Slootweg Allepuz","Tree Planter","Field Operations","gaetaneallepuz@gmail.com","6473813264","Thorold","ON","Jolissa Lonsberry","764731865","G1","No","Peter Hendrick Slootweg","4122771476","phslootweg@gmail.com","Scotiabank","002","22152","0980625","71.5 West St N"),
  emp("s26-008","Miah Jane Tretter","Tree Planter","Field Operations","miahtretter46@gmail.com","5193771355","Oakville","ON","Adam Deruyte","596079384","G2","No","Jon Tretter","5193752236","qm.wash@yahoo.ca","BMO","001","24062","3994336","306 River Side Dr"),
  emp("s26-009","Quinten Macleod Emmer","Tree Planter","Field Operations","qamemmer@gmail.com","6472206087","Stouffville","ON","Jolissa Lonsberry","591691316","G","Yes","Timothy Emmer","4165804541","tcwemmer@gmail.com","TD Canada Trust","004","37002","6437543","156 Church Street North"),
  emp("s26-010","Aidan McDonald","Tree Planter","Field Operations","aidan.mcdonald21@gmail.com","3433332339","Kingston","ON","Lucas James Watson","564648632","G","No","Vanessa Holmes","6135329787","Holmesv.rn@gmail.com","Scotiabank","002","24802","1180320","36 Wolfe St"),
  emp("s26-011","Ginger Anne Currie","Tree Planter","Field Operations","ginger.anne.72@gmail.com","6133401686","North Augusta","ON","Lucas James Watson","528518392","G1","No","Kathleen Currie","6133406547","","TD Canada Trust","004","22122","6253738","8827 Gosford Rd."),
  emp("s26-012","Evan MacDougall","Tree Planter","Field Operations","evan.macdougall6@gmail.com","2894393685","Burlington","ON","Adam Deruyte","550477541","G2","No","Steve MacDougall","9056305589","sgmacdougall@gmail.com","WealthSimple","703","00001","30385397","2108 Bartok Road"),
  emp("s26-013","Tyler Anthony Gallant","Tree Planter","Field Operations","tylergallant2858@gmail.com","2899332656","Hamilton","ON","Adam Deruyte","571182005","G2","No","Donna Gallant-Ernest","9055328944","","RBC","003","01922","5140686","269 Kensington Ave N"),
  emp("s26-014","Aidan Cliche","Tree Planter","Field Operations","aidancliche@gmail.com","2269771550","London","ON","Jolissa Lonsberry","544980600","G","No","David Cliche","5198687542","","RBC","003","02882","5081401","216 Base Line Rd E"),
  emp("s26-015","Richard Jackson Gattesco","Crew Boss","Field Operations","jacksongatt3519@gmail.com","2269301263","Southampton","ON","","547030767","GM2","No","Dean Gattesco","5193864544","deangattesco@gmail.com","Wealthsimple","703","00001","14523534","350 Saugeen Street"),
  emp("s26-016","Alexandra Garland","Tree Planter","Field Operations","ali.ga010203@gmail.com","5198591415","Dorchester","ON","Adam Deruyte","581008961","G","No","Tara Garland","5198609009","taragarland1@hotmail.com","TD Canada Trust","004","23602","6329959","4033 Catherine Street"),
  emp("s26-017","Diego Gonzalez","Tree Planter","Field Operations","1diego.gonz@gmail.com","5193245334","Leamington","ON","Adam Deruyte","571325059","G2","Yes","Jesus Gonzalez","2263408219","","Royal Bank of Canada","003","02642","5020441","4 Warren Ave"),
  emp("s26-018","William Danny Lubitz","Tree Planter","Field Operations","fanshiko@gmail.com","5489948238","Windsor","ON","Richard Jackson Gattesco","553433657","G2","No","Rebecca Lubitz","5194987432","rebeccalubitz1985@gmail.com","BMO","001","04732","393320","329 Curry Ave"),
  emp("s26-019","Ryan Terrance Clark","Tree Planter","Field Operations","05dipper@gmail.com","5193289013","Corunna","ON","Richard Jackson Gattesco","576077739","G","No","Ken Clark","5193125030","","RBC","003","01102","5064944","344 Bentinck St"),
  emp("s26-020","Tshimanga Orly Kanyinda","Tree Planter","Field Operations","orlykanyinda@gmail.com","6132204796","Ottawa","ON","Lucas James Watson","159513365","G1","No","Christel Kanyinda","2049600116","kanyindc@gmail.com","Royal Bank of Canada","003","02075","5129994","400 Den Haag Dr"),
  emp("s26-021","Wany Mawau Ruathdel","Tree Planter","Field Operations","mawauwany@gmail.com","2267394465","Windsor","ON","Lucas James Watson","593301716","G2","No","Gatwech Mawau","7052063528","gatwechmawau@gmail.com","CIBC","010","00192","8247293","628 Mill Street"),
  emp("s26-022","Gabrielle Voelzing","Kitchen Staff","Camp Services","gabrielle.voelzing@yahoo.com","5195714220","Kitchener","ON","","546458449","F","Yes","Brandon Wright","6474006885","brandyw0399@gmail.com","TD Canada Trust","004","00672","6268637","129 Waterloo Street"),
  emp("s26-023","Blu-Maszyel Simon","Tree Planter","Field Operations","blusimon78@gmail.com","6475454410","Whitby","ON","Richard Jackson Gattesco","577855919","G","No","Shereen","6475288610","shereensimon7878@gmail.com","BMO","001","29972","3864576","Brock Street"),
  emp("s26-024","Daniel Sivell-Legender","Tree Planter","Field Operations","legenderdan@gmail.com","7429865920","Huntsville","ON","Richard Jackson Gattesco","151957388","G","No","Tasha Connell","2267891507","tasha.connell@Hotmail.com","PC Financial","320","02002","5338660235687368","18 Cora St East"),
  emp("s26-025","Jolissa Lonsberry","Crew Boss","Field Operations","jolissa.lonsberry@gmail.com","6138475622","Belleville","ON","","539553776","C","Yes","Joe Lonsberry","6139622841","","Scotiabank","002","55046","0067628","104 Gracefield Lane"),
  emp("s26-026","Nathaniel Brouwer","Tree Planter","Field Operations","brounath772@gmail.com","2262248025","London","ON","Richard Jackson Gattesco","545672776","G","No","Richard Brouwer","5195218343","rbrouwer1970@icloud.com","TD Bank","004","00122","6446541","99 Bruce Street"),
  emp("s26-027","Stephanie McGee","Tree Planter","Field Operations","stephaniemcgee160@gmail.com","9054299713","Bowmanville","ON","Richard Jackson Gattesco","568104038","G","No","Sarah Robillard","9056236786","","Scotiabank","002","37572","0189286","1 Walbridge Court"),
  emp("s26-028","Christoph Neuland","Tree Planter","Field Operations","neulandchristoph@gmail.com","2262371545","Toronto","ON","Richard Jackson Gattesco","566193157","","No","Janis Neuland","6473810539","","Scotiabank","002","64816","0067415","308 Nairn Avenue"),
  emp("s26-029","Brittney Taylor Shanks","Tree Planter","Field Operations","brittneyshanks432@gmail.com","5197314090","Pontypool","ON","Adam Deruyte","527893861","G","No","Darlene Shanks","9056269315","Shanksyoutoo@aol.com","Scotiabank","002","14936","0200425","159 Corbett Drive Unit 1"),
  emp("s26-030","Michael Grivich","Tree Planter","Field Operations","michaelgrivich6@gmail.com","2899927475","Oshawa","ON","Lucas James Watson","536886997","","No","Rosemarie Grivich","9054337584","rgrivich@gmail.com","Simplii Financial","010","30800","0100165703","99/155 Glovers Rd"),
  emp("s26-031","Hayden Hudson-Cox","Tree Planter","Field Operations","haydenhudsoncox@gmail.com","6473327077","Toronto","ON","Lucas James Watson","550669733","G2","Yes","Heather","4168463125","heather@heatherhudson.ca","TD","004","03922","6501119","174 Willow Ave"),
  emp("s26-032","Sebastian Jagelewski","Tree Planter","Field Operations","sebjag1504@gmail.com","2269745229","Southampton","ON","Jolissa Lonsberry","558796645","G","No","Jayne Jagelewski","2266681229","jbjags@bmts.com","CIBC","010","03852","5321484","486 Creekwood Drive"),
  emp("s26-033","Charlie Malcolm Sylver","Tree Planter","Field Operations","charliesylver@gmail.com","5192707760","Southampton","ON","Lucas James Watson","554846923","G","No","Christy Sylver","5193860287","sylver@bmts.ca","CIBC","010","03852","5304237","216 Belcher Lane"),
  emp("s26-034","Finn Watson","Tree Planter","Field Operations","watson14finn@gmail.com","3433330193","Kingston","ON","Lucas James Watson","534388996","G","No","Kelly Hill","3433330867","Hillk974@gmail.com","TD Canada Trust","004","01902","6639924","59 Adelaide St"),
  emp("s26-035","Lucas James Watson","Crew Boss","Field Operations","awesomesaucelucas@gmail.com","7057407827","Cannington","ON","","557304219","G","Yes","Pam Watson","7053413457","","Scotiabank","002","85126","0369225","23 King St."),
  emp("s26-036","Addison McKenzie","Kitchen Staff","Camp Services","greyhell241@gmail.com","7059785106","North Bay","ON","","529765489","","No","Catherine Favreau","7055802441","","Royal Bank of Canada","003","03452","5256771","944 Beattie Street"),
  emp("s26-037","Zachary Robert Durham","Tree Planter","Field Operations","zachdurham80@icloud.com","2896750890","Seagrave","ON","Lucas James Watson","597491273","G","No","Robert Durham","4167109923","rtzldurham@gmail.com","BMO","001","36992","3945504","134 Southcrest Drive"),
  emp("s26-038","Benjamin Tyler Holmes","Tree Planter","Field Operations","bentholmes05@gmail.com","6135010365","Ottawa","ON","Adam Deruyte","548812726","G2","No","Eve Holmes","6137623023","obkmom@gmail.com","Royal Bank of Canada","003","02124","5201181","1605 St Georges St"),
  emp("s26-039","Adam Deruyte","Crew Boss","Field Operations","adammikederuyte@gmail.com","7053587528","North Bay","ON","","543013528","G1","No","Mike Deruyte","7054931287","Mikederuyte@gmail.com","Scotiabank","002","92122","1026380","240 Greenwood Avenue"),
  emp("s26-040","Cameron DeRuyte","Tree Planter","Field Operations","fpd.cameron@gmail.com","2495918371","Lindsay","ON","Adam Deruyte","566983359","","Yes","Michael DeRuyte","7054931287","","TD Canada Trust","004","31102","6477724","51 Cambridge Street N"),
  emp("s26-041","James Dean Gattesco","Tree Planter","Field Operations","jamesgattesco6@gmail.com","2269304344","Southampton","ON","Richard Jackson Gattesco","552139644","G","Yes","Dean Gattesco","5193864544","deangattesco@gmail.com","Peoples Trust","621","16001","218155813106","350 Saugeen Street"),
  emp("s26-042","Antoyne Gravelle","Tree Planter","Field Operations","antoyne1234@gmail.com","8196390187","Gatineau","QC","Jolissa Lonsberry","303416077","G","No","Suzanne Laprisw","8192305055","","Scotiabank","002","71191","0945080","260 Rue Oak"),
  emp("s26-043","Jordan Taylor","Tree Planter","Field Operations","jordantay203@gmail.com","6474256649","Ajax","ON","Jolissa Lonsberry","149427981","G2","No","Jordan Taylor","4166892309","annahslxove.lewis@gmail.com","WISE","621","16001","200116109331","392 Old Harwood Avenue"),
  emp("s26-044","Ché Breadner","Tree Planter","Field Operations","cheelijahjames@gmail.com","3435802885","Kingston","ON","Jolissa Lonsberry","542261268","G","No","Robby Breadner","6138763220","rob@hi-octanecreative.com","TD Bank","004","27002","6369492","111 Lower Union Street"),
  emp("s26-045","Keona Gingras","Tree Planter","Field Operations","keona8@rocketmail.com","6472142534","Markham","ON","Jolissa Lonsberry","550184030","G","No","Ray Gingras","9057585025","stephray@rogers.com","BMO","001","39932","3936087","57 Dancers Drive"),
  emp("s26-046","Chloé Ménard","Tree Planter","Field Operations","chloemenard24@gmail.com","6132982940","Casselman","ON","Richard Jackson Gattesco","556321529","G","Yes","Anne Legault","6132988335","annelegault29@gmail.com","Desjardins","829","00153","0143776","15 Percy St"),
  emp("s26-047","Brandon Maxwell Wright","Tree Planter","Field Operations","brandyw0399@gmail.com","6474006885","Deux Rivières","ON","Jolissa Lonsberry","957670177","G","Yes","Gabby Voelzing","5195714220","","CIBC","010","00792","5305691","860 Dunlop Crescent"),
  emp("s26-048","Djorbo Bakhit Mahmoud","Tree Planter","Field Operations","djorbobakhit@gmail.com","8733768165","Ottawa","ON","Adam Deruyte","599694387","G","Yes","Guenyey Tom Erdimi","6132404290","guenyeyt@gmail.com","RBC","003","00496","5335740","1112-1725 Frobisher Lane"),
  emp("s26-049","Ella Grace Williamson","Tree Planter","Field Operations","ellawilliamson03@gmail.com","2269889513","Waterloo","ON","Adam Deruyte","560005977","G1","No","Steve Williamson","2263399500","stevewilliamson112@gmail.com","TD","004","35352","6240288","252 Parkmount Dr"),
  emp("s26-050","Ben Feldman Starosta","Tree Planter","Field Operations","benben.starman@gmail.com","6134045259","Ottawa","ON","Lucas James Watson","556524650","G1","Yes","Joni Feldman","6135580909","jonifeldman@hotmail.com","CIBC","010","00206","5941296","22 Boyce Ave"),
  emp("s26-051","David Forrest Currie","Tree Planter","Field Operations","forrestcurrie.fc@gmail.com","6477710230","Toronto","ON","Richard Jackson Gattesco","542122155","G","Yes","David A. Currie","4169930044","","RBC","003","00189","5008289","216 Monarch Park Avenue"),
  emp("s26-052","Ethan Wild Robin","Tree Planter","Field Operations","ethanwildrobin@gmail.com","4163017038","Toronto","ON","Adam Deruyte","549151017","G","No","Tylar Robin","4169093209","Tylar.13.robin@gmail.com","TD Bank","004","03242","6647495","42 Charlemont Cres"),
  emp("s26-053","Joey Speicher","Tree Planter","Field Operations","speicherjoey@gmail.com","2262201775","Cambridge","ON","Adam Deruyte","579161118","G","No","Ted Speicher","2263389029","","TD Bank","004","00712","6328646","633 Parkview Crescent"),
  emp("s26-054","Ansley Che A","Tree Planter","Field Operations","cheansley5@gmail.com","5195885563","Kitchener","ON","Richard Jackson Gattesco","595056433","G","No","Simon Peter Chibicom A","2266064799","chibicompeter@gmail.com","WEALTHSIMPLE","703","00001","10646651","1511-600 Greenfield Ave"),
  emp("s26-055","Matthew Ronald Bell","Tree Planter","Field Operations","mattbellmrb@gmail.com","6139295676","Kingston","ON","Lucas James Watson","584347629","G1","No","Donna Bell","6134836593","donnabellforlife@gmail.com","TD","004","27002","6415028","1413 Thornwood Crescent"),
  emp("s26-056","Brendan Donald McKenzie","Tree Planter","Field Operations","brendanmckenzie95@gmail.com","2896962991","St. Catharines","ON","Jolissa Lonsberry","529876583","","No","Tafean Williston","2896962991","","Tangerine","614","00152","4016978907","111 Fourth Ave #12"),
  emp("s26-057","Benjamin Richard Leigh Ruben Mitchell","Tree Planter","Field Operations","footballben02@gmail.com","3439989232","Carleton Place","ON","Jolissa Lonsberry","566602470","G2","No","Melissa Mitchell","6132579232","missym_8@hotmail.com","Royal Bank of Canada","003","00842","5098215","124 William Street"),
  emp("s26-058","James Stephen Samhaber","Tree Planter","Field Operations","james.samhaber@gmail.com","6137255987","Ottawa","ON","Adam Deruyte","533074936","G","No","Bruce Samhaber","6132976961","Bruce.samhaber@gmail.com","Scotiabank","002","20396","0279927","112 Kenora Street"),
  emp("s26-059","Matthew Byrne Colas","Tree Planter","Field Operations","matthewcolas777@gmail.com","6479695268","Mississauga","ON","Richard Jackson Gattesco","551437353","G","No","Rosemary Colas","4169045268","roseandalexcolas@gmail.com","Wealthsimple","703","00001","31260821","448 Aqua Drive"),
  emp("s26-060","Mouhamadoul Moustapha Ndoye","Tree Planter","Field Operations","moustaphandoye737@gmail.com","2638812093","Gatineau","QC","Richard Jackson Gattesco","969205913","","No","Abdoul Aziz Lam","3435532104","Axiloc2003@gmail.com","Desjardins","829","00107","0619213","A-18 Rue Demontigny"),
  emp("s26-061","Noah Doell","Tree Planter","Field Operations","noahdoell041@gmail.com","6132502743","Peterborough","ON","Jolissa Lonsberry","599315157","G","No","Carley Doell","6138594881","cdoell44@gmail.com","RBC","003","01672","5185707","28A Springbrook Drive"),
  emp("s26-062","Real Bain","Tree Planter","Field Operations","rayraybain001@gmail.com","6477248941","Toronto","ON","Richard Jackson Gattesco","552450926","","No","Nancy Patel","6476808784","Onsitehealth@rogers.com","RBC","003","06352","5094370","225 Gladstone Avenue"),
  emp("s26-063","Sebastian Candela","Tree Planter","Field Operations","sebicand@gmail.com","6138934636","Kingston","ON","Jolissa Lonsberry","569796881","G","No","Rudy Candela","6135442658","candelar@limestone.on.ca","TD Bank","004","01392","6710220","46 Mowat Ave"),
];

// Exact crew boss name → list of planter emails
const CREW_ASSIGNMENTS: Record<string, string[]> = {
  "Jolissa Lonsberry": [
    "scoutbroughton@gmail.com",
    "emapab@gmail.com",
    "calebgonsalves222@gmail.com",
    "gaetaneallepuz@gmail.com",
    "qamemmer@gmail.com",
    "aidancliche@gmail.com",
    "sebjag1504@gmail.com",
    "antoyne1234@gmail.com",
    "jordantay203@gmail.com",
    "cheelijahjames@gmail.com",
    "keona8@rocketmail.com",
    "brandyw0399@gmail.com",
    "brendanmckenzie95@gmail.com",
    "footballben02@gmail.com",
    "noahdoell041@gmail.com",
    "sebicand@gmail.com",
  ],
  "Richard Jackson Gattesco": [
    "malcolmcowley005@gmail.com",
    "fanshiko@gmail.com",
    "05dipper@gmail.com",
    "blusimon78@gmail.com",
    "legenderdan@gmail.com",
    "brounath772@gmail.com",
    "stephaniemcgee160@gmail.com",
    "jamesgattesco6@gmail.com",
    "chloemenard24@gmail.com",
    "forrestcurrie.fc@gmail.com",
    "cheansley5@gmail.com",
    "matthewcolas777@gmail.com",
    "moustaphandoye737@gmail.com",
    "rayraybain001@gmail.com",
    "neulandchristoph@gmail.com",
  ],
  "Lucas James Watson": [
    "aidan.mcdonald21@gmail.com",
    "ginger.anne.72@gmail.com",
    "orlykanyinda@gmail.com",
    "mawauwany@gmail.com",
    "michaelgrivich6@gmail.com",
    "haydenhudsoncox@gmail.com",
    "charliesylver@gmail.com",
    "watson14finn@gmail.com",
    "zachdurham80@icloud.com",
    "benben.starman@gmail.com",
    "mattbellmrb@gmail.com",
  ],
  "Adam Deruyte": [
    "davente563@gmail.com",
    "miahtretter46@gmail.com",
    "evan.macdougall6@gmail.com",
    "tylergallant2858@gmail.com",
    "ali.ga010203@gmail.com",
    "1diego.gonz@gmail.com",
    "brittneyshanks432@gmail.com",
    "bentholmes05@gmail.com",
    "fpd.cameron@gmail.com",
    "ellawilliamson03@gmail.com",
    "djorbobakhit@gmail.com",
    "ethanwildrobin@gmail.com",
    "speicherjoey@gmail.com",
    "james.samhaber@gmail.com",
  ],
};

/** Update crewBoss on every employee in the system to match the canonical crew boss name. */
export async function assignCrewBosses2026(employees: Employee[]): Promise<number> {
  const emailToCrewBoss: Record<string, string> = {};
  for (const [bossName, emails] of Object.entries(CREW_ASSIGNMENTS)) {
    for (const email of emails) {
      emailToCrewBoss[email.toLowerCase()] = bossName;
    }
  }

  let updated = 0;
  for (const emp of employees) {
    const bossName = emailToCrewBoss[emp.email.toLowerCase()];
    if (bossName && emp.crewBoss !== bossName) {
      const updatedEmp = { ...emp, crewBoss: bossName };
      await saveRecord("employees", updatedEmp);
      updated++;
    }
  }
  return updated;
}
