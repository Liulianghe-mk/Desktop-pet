/// <reference types="vite/client" />

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResult[];
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
