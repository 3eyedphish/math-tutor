"""Records every Little learner sentence as a small mp3 in public/voice/ (one-off, run on a dev machine).

The voice is Kokoro-82M (Apache-2.0 open model), voice af_heart, run locally: no paid service.
Letter names [B] and letter sounds [/B/] are spoken from exact phonetic spellings below, never guessed.

Setup (once):  pip install kokoro-onnx soundfile
               download kokoro-v1.0.onnx and voices-v1.0.bin from
               https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
Usage:         node tools/voice/lines.mjs                      (lists the sentences)
               python3 tools/voice/make.py --model DIR [--force] (records the new ones; needs ffmpeg)
               node tools/voice/lines.mjs --ids                 (tells the app which recordings exist)
"""
import argparse, json, os, re, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VOICE, SPEED = "af_heart", 0.9

# Letter names (US English).
NAME = {
    "A": "ˈeɪ", "B": "bˈiː", "C": "sˈiː", "D": "dˈiː", "E": "ˈiː", "F": "ˈɛf", "G": "dʒˈiː", "H": "ˈeɪtʃ",
    "I": "ˈaɪ", "J": "dʒˈeɪ", "K": "kˈeɪ", "L": "ˈɛl", "M": "ˈɛm", "N": "ˈɛn", "O": "ˈoʊ", "P": "pˈiː",
    "Q": "kjˈuː", "R": "ˈɑːɹ", "S": "ˈɛs", "T": "tˈiː", "U": "jˈuː", "V": "vˈiː", "W": "dˈʌbəljˌuː",
    "X": "ˈɛks", "Y": "wˈaɪ", "Z": "zzˈiː",
}
# Letter sounds, as a preschool teacher says them: short vowels, held hums and hisses, and
# clipped stops with only a whisper of "uh" after them.
SOUND = {
    "A": "ˈæ", "B": "bᵊ", "C": "kᵊ", "D": "dᵊ", "E": "ˈɛ", "F": "fː", "G": "ɡᵊ", "H": "hᵊ",
    "I": "ˈɪ", "J": "dʒᵊ", "K": "kᵊ", "L": "lll", "M": "mmm", "N": "nnn", "O": "ˈɑ", "P": "pᵊ",
    "Q": "kwᵊ", "R": "ɹɹɹ", "S": "sː", "T": "tᵊ", "U": "ˈʌ", "V": "vvv", "W": "wᵊ", "X": "ks",
    "Y": "jᵊ", "Z": "zzz",
}
# Names said after a tiny pause: the voice softens a z straight after another word, so "letter zee"
# came out as "letter see". A pause and a slightly longer z keep the buzz.
PAUSE_BEFORE = {"Z"}
# Words the pronunciation dictionary gets wrong or says in a less common way.
WORD = {
    "iguana": "ɪɡwˈɑːnə", "envelope": "ˈɛnvəlˌoʊp", "inchworm": "ˈɪntʃwɜɹm", "worm": "wˈɜɹm",
    "jack-o'-lantern": "dʒˈækəlˌæntɚn",
}
MARK = re.compile(r"\[/([A-Z])/\]|\[([A-Z])\]|\b(" + "|".join(re.escape(w) for w in sorted(WORD, key=len, reverse=True)) + r")\b", re.I)


def phonemes(text, tk):
    out, at = [], 0
    for m in MARK.finditer(text):
        out.append(tk.phonemize(text[at:m.start()], "en-us") if text[at:m.start()].strip() else text[at:m.start()])
        # A sound gets a short pause on each side, as a teacher sets it apart: "B says, b, like ball."
        out.append(f", {SOUND[m.group(1)]}," if m.group(1) else (", " if m.group(2) in PAUSE_BEFORE else "") + NAME[m.group(2)] if m.group(2) else WORD[m.group(3).lower()])
        at = m.end()
    if text[at:].strip(): out.append(tk.phonemize(text[at:], "en-us"))
    else: out.append(text[at:])
    s = " ".join(p.strip() for p in out if p.strip())
    s = re.sub(r"\s+([,.!?])", r"\1", s)
    s = re.sub(r",\s*([,.!?])", r"\1", s)
    return re.sub(r"^[,\s]+", "", s)


def trim(audio, sr, margin=0.08):
    """Cut the silence at both ends, gently (the model's own trim can clip a quiet first t or h)."""
    import numpy as np
    fr = int(sr * 0.01)
    rms = np.array([np.sqrt((audio[i:i + fr] ** 2).mean()) for i in range(0, len(audio) - fr, fr)])
    on = np.where(rms > rms.max() * 0.01)[0]
    if not len(on): return audio
    a, b = max(0, on[0] * fr - int(margin * sr)), min(len(audio), (on[-1] + 1) * fr + int(margin * sr))
    return audio[a:b]


# A word said all on its own ("Sock.", "[T].") comes out less steady from the model than words in a
# sentence (a lost first sound, or an extra one). With --asr, each such clip is made a few ways and
# a speech recognizer (Whisper base.en via sherpa-onnx, also free and local) picks one it hears right.
VOICELESS = ("f", "s", "ʃ", "θ", "t", "k", "p", "h")


def clean_start(audio, sr, ph):
    """The model starts every clip with a short voiced blip. Before a voiceless first sound that
    blip is heard as an extra vowel ("Fox" as "uh-fox" or "vox"), so cut it off there."""
    import numpy as np
    if not ph.lstrip("ˈˌ, ").startswith(VOICELESS): return audio
    fr = int(sr * 0.01)
    n = len(audio) // fr
    rms = np.array([np.sqrt((audio[i * fr:(i + 1) * fr] ** 2).mean()) for i in range(n)])
    zcr = np.array([(np.sign(audio[i * fr + 1:(i + 1) * fr]) != np.sign(audio[i * fr:(i + 1) * fr - 1])).mean() for i in range(n)])
    on = int(np.argmax(rms > rms.max() * 0.01))
    hiss = [i for i in range(on, min(n, on + 25)) if zcr[i] > 0.3 and rms[i] > rms.max() * 0.03]
    if not hiss or hiss[0] - on > 20: return audio
    out = audio[max(0, hiss[0] - 1) * fr:].copy()
    k = min(len(out), int(sr * 0.005)); out[:k] *= np.linspace(0, 1, k)
    return out


def alone(text):
    return bool(re.fullmatch(r"\[[A-Z]\][.!?]|[A-Za-z'-]+\.", text))


HEARD = {"A": "a ay", "B": "b be bee", "C": "c see sea", "D": "d dee", "E": "e", "F": "f eff", "G": "g gee", "H": "h aitch",
         "I": "i eye aye", "J": "j jay", "K": "k kay", "L": "l el elle", "M": "m em", "N": "n en", "O": "o oh", "P": "p pee",
         "Q": "q cue queue", "R": "r are", "S": "s ess", "T": "t tee tea", "U": "u you", "V": "v vee", "W": "w", "X": "x ex",
         "Y": "y why", "Z": "z zee"}
DIGITS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
          "11": "eleven", "12": "twelve", "13": "thirteen", "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen", "18": "eighteen", "19": "nineteen", "20": "twenty"}


def heard_right(text, got):
    words = [DIGITS.get(w, w) for w in re.sub(r"[^a-z0-9' ]", " ", got.lower().replace("-", " ")).split()]
    if len(words) != 1 and not (len(words) == 2 and "".join(words) == re.sub(r"[^a-z]", "", text.lower())): return False
    m = re.fullmatch(r"\[([A-Z])\].", text)
    if m: return words[0] in HEARD[m.group(1)].split()
    want = re.sub(r"[^a-z]", "", text.lower())
    return "".join(words).replace("'", "") == want


LEAD = {"letter": "ðə lˈɛɾɚ,", "word": "ðə wˈɜɹd ɪz,"}


def after_lead(audio, sr, lead_len):
    """Cut a lead-in off at the quietest moment near its end (its comma pause)."""
    import numpy as np
    fr = int(sr * 0.01)
    rms = np.array([np.sqrt((audio[i:i + 2 * fr] ** 2).mean()) for i in range(0, len(audio) - 2 * fr, fr)])
    lo, hi = int(lead_len * 0.7 / 0.01), min(len(rms) - 15, int((lead_len + 0.35) / 0.01))
    if hi <= lo: return audio
    return audio[(lo + int(np.argmin(rms[lo:hi])) + 1) * fr:]


def take(k, ph, voice, speed, lead=None):
    """One recording of the phonemes; with lead, said after "the letter," (or "the word is,"), which is then cut off."""
    if lead:
        la, sr = k.create(LEAD[lead], voice=voice, speed=speed, is_phonemes=True, trim=False)
        audio, sr = k.create(LEAD[lead] + " " + ph, voice=voice, speed=speed, is_phonemes=True, trim=False)
        return trim(after_lead(trim(audio, sr), sr, len(trim(la, sr, margin=0)) / sr), sr), sr
    audio, sr = k.create(ph, voice=voice, speed=speed, is_phonemes=True, trim=False)
    return trim(clean_start(trim(audio, sr, margin=0), sr, ph), sr, margin=0.05), sr


def make_asr(d):
    import sherpa_onnx
    rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=os.path.join(d, "base.en-encoder.onnx"), decoder=os.path.join(d, "base.en-decoder.onnx"), tokens=os.path.join(d, "base.en-tokens.txt"), num_threads=4)
    def asr(audio, sr):
        import numpy as np
        pad = np.zeros(int(sr * 0.6), "float32")
        st = rec.create_stream(); st.accept_waveform(sr, np.concatenate([pad, audio.astype("float32"), pad])); rec.decode_stream(st)
        return st.result.text.strip()
    return asr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="folder with kokoro-v1.0.onnx and voices-v1.0.bin")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", help="record only lines containing this text")
    ap.add_argument("--out", default=os.path.join(ROOT, "public", "voice"))
    ap.add_argument("--reverse", action="store_true", help="work from the end (to run a second copy alongside)")
    ap.add_argument("--asr", help="folder with sherpa-onnx-whisper-base.en, to pick the best take of one-word clips")
    a = ap.parse_args()
    from kokoro_onnx import Kokoro
    import soundfile as sf
    k = Kokoro(os.path.join(a.model, "kokoro-v1.0.onnx"), os.path.join(a.model, "voices-v1.0.bin"))
    lines = json.load(open(os.path.join(ROOT, "tools", "voice", "lines.json"), encoding="utf-8"))
    if a.reverse: lines = lines[::-1]
    os.makedirs(a.out, exist_ok=True)
    asr = make_asr(a.asr) if a.asr else None
    made, unsure = 0, []
    for ln in lines:
        dst = os.path.join(a.out, ln["id"] + ".mp3")
        if a.only and a.only not in ln["text"]: continue
        if os.path.exists(dst) and not a.force: continue
        ph = phonemes(ln["text"], k.tokenizer)
        takes = [(VOICE, SPEED, None)]
        if asr and alone(ln["text"]):
            lead = "letter" if ln["text"].startswith("[") else "word"
            takes += [(VOICE, 0.8, None), (VOICE, 1.0, None), (VOICE, SPEED, lead), (VOICE, 0.8, lead), ("af_bella", SPEED, None), ("af_sarah", SPEED, None)]
        first = None
        for voice, speed, lead in takes:
            audio, sr = take(k, ph, voice, speed, lead)
            first = first if first is not None else audio
            if len(takes) == 1 or heard_right(ln["text"], asr(audio, sr)): break
        else:
            audio = first
            unsure.append(ln["text"])
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t: wav = t.name
        sf.write(wav, audio, sr)
        # Mono 32 kb/s mp3 (plays everywhere, about 5 KB a sentence).
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-ar", "24000", "-b:a", "32k", dst], check=True)
        os.remove(wav)
        made += 1
        if made % 100 == 0: print(made, "…", file=sys.stderr)
    print(f"recorded {made} of {len(lines)} lines into {a.out}")
    if unsure: print("no take was heard right (kept the first):", " | ".join(unsure))


if __name__ == "__main__":
    main()
