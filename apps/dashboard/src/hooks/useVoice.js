import { useState, useRef, useEffect, useCallback } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

const synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

export function useVoice({ lang = 'es', onTranscript }) {
    const [isListening, setIsListening] = useState(false);
    const [sttSupported] = useState(() => !!SpeechRecognition);
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [ttsSupported] = useState(() => !!synthesis);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const recognitionRef = useRef(null);
    const onTranscriptRef = useRef(onTranscript);

    useEffect(() => {
        onTranscriptRef.current = onTranscript;
    }, [onTranscript]);

    useEffect(() => {
        if (!SpeechRecognition) return;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = lang === 'es' ? 'es-ES' : 'en-US';

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            onTranscriptRef.current?.(transcript);
            setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        return () => recognition.abort();
    }, [lang]);

    const toggleListening = useCallback(() => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    }, [isListening]);

    const speak = useCallback((text) => {
        if (!synthesis || !text) return;
        synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        synthesis.speak(utterance);
    }, [lang]);

    const speakAsync = useCallback((text) => {
        return new Promise((resolve) => {
            if (!synthesis || !text) { resolve(); return; }
            synthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => { setIsSpeaking(false); resolve(); };
            utterance.onerror = () => { setIsSpeaking(false); resolve(); };
            synthesis.speak(utterance);
        });
    }, [lang]);

    const stopSpeaking = useCallback(() => {
        synthesis?.cancel();
        setIsSpeaking(false);
    }, []);

    useEffect(() => {
        return () => {
            recognitionRef.current?.abort();
            synthesis?.cancel();
        };
    }, []);

    return {
        sttSupported,
        isListening,
        toggleListening,
        ttsSupported,
        ttsEnabled,
        setTtsEnabled,
        isSpeaking,
        speak,
        speakAsync,
        stopSpeaking,
    };
}
