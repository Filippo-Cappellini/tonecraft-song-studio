import guitar from "@/assets/inst-guitar.jpg";
import bass from "@/assets/inst-bass.jpg";
import piano from "@/assets/inst-piano.jpg";
import drums from "@/assets/inst-drums.jpg";

export const instrumentImages: Record<string, string> = {
  chitarra: guitar,
  basso: bass,
  pianoforte: piano,
  batteria: drums,
};

export const difficultyLabel = ["", "Principiante", "Facile", "Intermedio", "Avanzato", "Esperto"];
