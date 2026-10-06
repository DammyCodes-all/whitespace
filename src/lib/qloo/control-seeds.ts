/**
 * Control seed material per domain. Owned by Q.
 *
 * Unrelated on purpose, famous on purpose: controls must be genuinely
 * unrelated to any pitch (§6.4) and likely held by Qloo. Film and music
 * carry the full 20; book and game carry a fallback 6 until the coverage
 * test (`docs/qloo-coverage.md`) picks the demo domain.
 */

import type { WorkType } from "@/lib/types";

export interface ControlSeed {
  name: string;
  titles: string[];
}

export const CONTROL_SEEDS: Record<WorkType, ControlSeed[]> = {
  film: [
    {
      name: "Blockbuster action",
      titles: ["Die Hard", "Mad Max: Fury Road", "John Wick"],
    },
    {
      name: "Prestige drama",
      titles: ["The Godfather", "Schindler's List", "12 Years a Slave"],
    },
    {
      name: "Romantic comedy",
      titles: ["Notting Hill", "When Harry Met Sally", "Crazy Rich Asians"],
    },
    {
      name: "Horror",
      titles: ["Halloween", "A Nightmare on Elm Street", "Get Out"],
    },
    {
      name: "Documentary",
      titles: ["March of the Penguins", "Free Solo", "13th"],
    },
    { name: "Animation", titles: ["Toy Story", "Spirited Away", "Shrek"] },
    {
      name: "Western",
      titles: ["The Good, the Bad and the Ugly", "Unforgiven", "True Grit"],
    },
    {
      name: "Musical",
      titles: ["Singin' in the Rain", "La La Land", "Mamma Mia!"],
    },
    {
      name: "Thriller",
      titles: ["Se7en", "Gone Girl", "The Silence of the Lambs"],
    },
    { name: "Sci-fi epic", titles: ["Star Wars", "Avatar", "Interstellar"] },
    {
      name: "Fantasy",
      titles: ["The Lord of the Rings", "Harry Potter", "Pan's Labyrinth"],
    },
    { name: "Crime", titles: ["Goodfellas", "Pulp Fiction", "The Departed"] },
    { name: "Indie drama", titles: ["Lady Bird", "Moonlight", "Nomadland"] },
    { name: "War film", titles: ["Saving Private Ryan", "1917", "Dunkirk"] },
    { name: "Sports", titles: ["Rocky", "Remember the Titans", "Moneyball"] },
    { name: "Family", titles: ["E.T.", "Home Alone", "Paddington"] },
    {
      name: "Silent classic",
      titles: ["Metropolis", "Modern Times", "The General"],
    },
    {
      name: "Foreign drama",
      titles: ["Parasite", "Amélie", "Cinema Paradiso"],
    },
    {
      name: "Superhero",
      titles: ["The Dark Knight", "Black Panther", "Spider-Man"],
    },
    {
      name: "Holiday",
      titles: ["It's a Wonderful Life", "Elf", "Love Actually"],
    },
  ],
  music: [
    { name: "Pop", titles: ["Taylor Swift", "Michael Jackson", "ABBA"] },
    { name: "Hip-hop", titles: ["Kendrick Lamar", "Jay-Z", "Missy Elliott"] },
    { name: "Rock", titles: ["The Beatles", "Queen", "Nirvana"] },
    {
      name: "Country",
      titles: ["Johnny Cash", "Dolly Parton", "Chris Stapleton"],
    },
    {
      name: "Jazz",
      titles: ["Miles Davis", "John Coltrane", "Ella Fitzgerald"],
    },
    { name: "Classical", titles: ["Beethoven", "Mozart", "Yo-Yo Ma"] },
    { name: "Electronic", titles: ["Daft Punk", "Kraftwerk", "Aphex Twin"] },
    { name: "R&B", titles: ["Beyoncé", "Marvin Gaye", "Alicia Keys"] },
    { name: "Metal", titles: ["Metallica", "Black Sabbath", "Iron Maiden"] },
    {
      name: "Folk",
      titles: ["Bob Dylan", "Joni Mitchell", "Simon & Garfunkel"],
    },
    { name: "Punk", titles: ["The Clash", "Ramones", "Patti Smith"] },
    {
      name: "Reggae",
      titles: ["Bob Marley", "Toots and the Maytals", "Burning Spear"],
    },
    { name: "Blues", titles: ["B.B. King", "Muddy Waters", "Etta James"] },
    {
      name: "Soul",
      titles: ["Aretha Franklin", "Otis Redding", "Stevie Wonder"],
    },
    { name: "Disco", titles: ["Bee Gees", "Donna Summer", "Chic"] },
    {
      name: "Indie rock",
      titles: ["Radiohead", "Arctic Monkeys", "The Strokes"],
    },
    { name: "K-pop", titles: ["BTS", "BLACKPINK", "IU"] },
    {
      name: "Latin",
      titles: ["Bad Bunny", "Shakira", "Buena Vista Social Club"],
    },
    {
      name: "Ambient",
      titles: ["Brian Eno", "Stars of the Lid", "Aphex Twin"],
    },
    {
      name: "Gospel",
      titles: ["Mahalia Jackson", "Kirk Franklin", "The Staple Singers"],
    },
  ],
  book: [
    {
      name: "Classic novel",
      titles: ["Pride and Prejudice", "Moby Dick", "Jane Eyre"],
    },
    {
      name: "Mystery",
      titles: ["Agatha Christie", "Arthur Conan Doyle", "Tana French"],
    },
    {
      name: "Science fiction",
      titles: ["Dune", "Neuromancer", "Ursula K. Le Guin"],
    },
    {
      name: "Fantasy",
      titles: ["J.R.R. Tolkien", "Brandon Sanderson", "N.K. Jemisin"],
    },
    { name: "Memoir", titles: ["Educated", "Becoming", "Born a Crime"] },
    { name: "Poetry", titles: ["Mary Oliver", "Rumi", "Ocean Vuong"] },
  ],
  game: [
    {
      name: "Platformer",
      titles: ["Super Mario Bros.", "Celeste", "Hollow Knight"],
    },
    { name: "RPG", titles: ["The Witcher 3", "Skyrim", "Final Fantasy VII"] },
    { name: "Shooter", titles: ["Halo", "Call of Duty", "Half-Life 2"] },
    { name: "Puzzle", titles: ["Tetris", "Portal", "The Witness"] },
    { name: "Strategy", titles: ["Civilization VI", "StarCraft", "XCOM 2"] },
    {
      name: "Horror game",
      titles: ["Resident Evil", "Silent Hill 2", "Amnesia"],
    },
  ],
};
