import { getNiche } from "./niches";

/** Diverse first/last name pools for believable, varied persona identities. */
const FIRST_NAMES = [
  "Maya", "Liam", "Aisha", "Noah", "Sofia", "Ethan", "Zara", "Lucas", "Nina", "Omar",
  "Chloe", "Mateo", "Priya", "Daniel", "Yara", "Hugo", "Leila", "Marcus", "Anaïs", "Kenji",
  "Amara", "Theo", "Ines", "Diego", "Mei", "Felix", "Tara", "Andre", "Lina", "Caleb",
  "Nadia", "Ravi", "Elena", "Samuel", "Fatima", "Oscar", "Jade", "Ibrahim", "Camila", "Yuki",
  "Hannah", "Malik", "Clara", "Adrian", "Sana", "Nathan", "Rosa", "Emeka", "Iris", "Tomás",
  "Layla", "Victor", "Maya", "Jonas", "Amina", "Leo", "Bianca", "Karim", "Stella", "Aaron",
  "Nora", "Pablo", "Hana", "Julian", "Maria", "Sven", "Asha", "Roman", "Lea", "Idris",
];

const LAST_NAMES = [
  "Carter", "Nguyen", "Okafor", "Silva", "Patel", "Kowalski", "Haddad", "Rossi", "Mensah", "Tanaka",
  "Bauer", "Castro", "Lindqvist", "Diallo", "Moreau", "Singh", "Hernandez", "Kim", "Novak", "Abebe",
  "Costa", "Fischer", "Reyes", "Bianchi", "Ali", "Sørensen", "Mwangi", "Romano", "Petrov", "Dubois",
  "Khan", "Andersson", "Ferreira", "Yamamoto", "Adeyemi", "Marino", "Lopez", "Becker", "Traoré", "Wong",
  "Schmidt", "Oliveira", "Haas", "Mbeki", "Conti", "Park", "Vargas", "Holm", "Iqbal", "Greco",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomName(): { first: string; last: string; name: string } {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  return { first, last, name: `${first} ${last}` };
}

/** Generate a unique-ish username. Caller must still ensure DB uniqueness. */
export function buildUsername(first: string, last: string): string {
  const f = first.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  const l = last.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  const styles = [
    () => `${f}.${l}`,
    () => `${f}${l}`,
    () => `${f}_${l}`,
    () => `${f}${l}${10 + Math.floor(Math.random() * 89)}`,
    () => `${f}.${l[0]}`,
    () => `real${f}${l[0]}`,
    () => `${f}${l[0]}.official`,
  ];
  return pick(styles)();
}

const BIO_TEMPLATES: Record<string, string[]> = {
  fitness: ["Coach & lifelong learner 💪", "Helping you move better, daily", "Strength is a habit"],
  food: ["Made with love, served fresh 🍴", "Home cook chasing flavor", "Good food, good mood"],
  realestate: ["Helping families find home 🏡", "Local market, big results", "Your neighborhood agent"],
  beauty: ["Glow from the inside out ✨", "Skincare > makeup", "Self-care advocate"],
  ecommerce: ["Small shop, big dreams 🛍️", "Curating things I love", "Founder & packer of orders"],
  tech: ["Building useful things 🚀", "Automating the boring stuff", "Indie maker"],
  travel: ["Collecting moments, not things ✈️", "Always one trip ahead", "Slow travel believer"],
  coaching: ["Clarity over hustle 📈", "Helping founders grow", "Systems & strategy"],
  homedecor: ["Cozy spaces, calm minds 🪴", "Less but better", "Styling everyday corners"],
  pets: ["Pawrent & rescue advocate 🐾", "Here for the floofs", "Treats earned daily"],
  events: ["Turning moments into magic 💍", "Calm in the chaos", "Booking next season now"],
  creator: ["Creating just because 🎬", "Consistency over virality", "Behind the scenes daily"],
};

export function buildBio(niche: string): string {
  const list = BIO_TEMPLATES[niche] ?? ["Sharing what I love", "Just getting started"];
  // occasionally append a niche noun flourish
  const base = pick(list);
  if (Math.random() < 0.3) {
    const noun = pick(getNiche(niche).nouns);
    return `${base} · all about the ${noun}`;
  }
  return base;
}
