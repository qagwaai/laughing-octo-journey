export const CHARACTER_NAME_SUGGESTIONS: readonly string[] = [
  'Amina Hassan',
  'Kenji Sato',
  'Sofia Alvarez',
  'Liam OConnor',
  'Priya Nair',
  'Nia Okafor',
  'Mateo Rivera',
  'Hana Kim',
  'Omar Farouk',
  'Elena Petrova',
  'Noah Mensah',
  'Rina Tanaka',
  'Arjun Mehta',
  'Leila Rahimi',
  'Diego Castillo',
  'Yara Haddad',
  'Maya Singh',
  'Tariq Suleiman',
  'Lucia Romano',
  'Jonas Muller',
  'Zara Khan',
  'Emre Demir',
  'Ines Duarte',
  'Kofi Boateng',
  'Nadia Karim',
  'Ivan Markov',
  'Aiko Watanabe',
  'Samir Patel',
  'Lina Ibrahim',
  'Rafael Costa',
  'Chloe Martin',
  'Abena Owusu',
  'Yusuf Ali',
  'Mei Chen',
  'Andres Vega',
  'Fatima Noor',
  'Dara Novak',
  'Hugo Silva',
  'Ayse Yildiz',
  'Kwame Asare',
  'Sara Benali',
  'Ryo Nakamura',
  'Camila Torres',
  'Malik Johnson',
  'Anya Volkov',
  'Nour Elmasry',
  'Thiago Lima',
  'Asha Raman',
  'Binta Diallo',
  'Milan Jovanovic',
  'Lara Weiss',
  'Idris Mahmoud',
  'Keiko Ito',
  'Paulo Mendes',
  'Sana Rahman',
  'Nikolai Petrenko',
  'Jamal Adeyemi',
  'Elif Kaya',
  'Valentina Rojas',
  'Ravi Kulkarni',
  'Mina Choi',
  'Tomas Novak',
  'Aaliyah Brooks',
  'Farah Siddiqui',
  'Hector Morales',
  'Dina Saleh',
  'Yuki Mori',
  'Ibrahim Konate',
  'Ana Lucia Gomez',
  'Kiran Desai',
  'Selin Acar',
  'Pedro Sousa',
  'Nadine Saad',
  'Satoshi Arai',
  'Marta Kowalska',
  'Amadou Cisse',
  'Layla Nasser',
  'Bruno Ferreira',
  'Neha Iyer',
  'Said Chikhaoui',
  'Ren Ito',
  'Carla Dominguez',
  'Mustafa Yilmaz',
  'Grace Ndlovu',
  'Julian Ortega',
  'Rania Khoury',
  'Dmitri Sokolov',
  'Pooja Bhat',
  'Ari Kimura',
  'Hamza Qureshi',
  'Nora Larsson',
  'Felipe Navarro',
  'Zainab Bello',
  'Elias Haddad',
  'Talia Cohen',
  'Boris Ivanov',
  'Nina Popescu',
  'Adeel Hussain',
  'Yasmin Rahal',
  'Kenta Fujimoto',
  'Mariana Paredes',
  'Soren Dahl',
];

export function normalizeCharacterName(rawName: string): string {
  return rawName.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function pickSuggestedCharacterName(options: {
  existingNames: readonly string[];
  previousSuggestion: string | null;
  disallowName?: string | null;
}): string {
  const existing = new Set(options.existingNames.map((name) => normalizeCharacterName(name)));
  const previous = options.previousSuggestion ? normalizeCharacterName(options.previousSuggestion) : null;
  const disallow = options.disallowName ? normalizeCharacterName(options.disallowName) : null;

  const uniquePool = CHARACTER_NAME_SUGGESTIONS.filter(
    (candidate) => !existing.has(normalizeCharacterName(candidate)),
  );

  const withoutImmediateRepeat = uniquePool.filter((candidate) => {
    const normalized = normalizeCharacterName(candidate);
    return normalized !== previous && normalized !== disallow;
  });

  const pool =
    withoutImmediateRepeat.length > 0
      ? withoutImmediateRepeat
      : uniquePool.length > 0
        ? uniquePool
        : CHARACTER_NAME_SUGGESTIONS;

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}
