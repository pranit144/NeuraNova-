#!/usr/bin/env python3
"""
build_curriculum.py — Auto-generate curriculum.js from PDF files

This script scans the pdfs/ directory, reads phase-config.json for phase
metadata, and generates js/curriculum.js automatically.

NAMING CONVENTION FOR PDFs:
    pdfs/phase-X/NN-title-words-here.pdf
    
    - NN = two-digit lesson number (01, 02, 03...)
    - title words separated by hyphens
    - Examples:
        pdfs/phase-0/01-what-is-ai.pdf
        pdfs/phase-0/02-history-of-ai.pdf
        pdfs/phase-1/09-python-fundamentals.pdf

HOW TO ADD A NEW PDF:
    1. Drop your PDF into the correct pdfs/phase-X/ folder
    2. Name it following the convention: NN-title-words.pdf
    3. Run: python build_curriculum.py
    4. (Or just push to GitHub — the Action does it automatically)

HOW TO ADD A NEW PHASE:
    1. Add an entry to phase-config.json
    2. Create the folder: pdfs/phase-X/
    3. Drop PDFs inside
    4. Run: python build_curriculum.py
"""

import json
import os
import re
import sys
import io

# Fix Windows console encoding for emoji output
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ---------- Configuration ----------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = SCRIPT_DIR  # Script lives at project root

PDFS_DIR = os.path.join(ROOT_DIR, "pdfs")
PHASE_CONFIG_PATH = os.path.join(ROOT_DIR, "phase-config.json")
OUTPUT_PATH = os.path.join(ROOT_DIR, "js", "curriculum.js")

# ---------- Helpers ----------

def parse_pdf_filename(filename):
    """
    Parse a PDF filename like '01-what-is-ai.pdf' into (number, title).
    Returns (lesson_number: int, title: str) or None if invalid.
    """
    # Remove .pdf extension
    name = filename.rsplit(".", 1)[0]
    
    # Match pattern: NN-title-words OR NN_title_words
    match = re.match(r'^(\d+)[-_](.+)$', name)
    if not match:
        # Try just a number
        match = re.match(r'^(\d+)$', name)
        if match:
            return int(match.group(1)), f"Lesson {match.group(1)}"
        return None
    
    num = int(match.group(1))
    raw_title = match.group(2)
    
    # Convert hyphens/underscores to spaces and title-case
    title = raw_title.replace("-", " ").replace("_", " ")
    title = title_case_smart(title)
    
    return num, title


def title_case_smart(text):
    """
    Smart title case that handles common abbreviations and short words.
    """
    # Words to keep uppercase
    uppercase_words = {
        "ai", "ml", "dl", "nlp", "llm", "llms", "rag", "cnn", "rnn",
        "lstm", "gpt", "bert", "api", "apis", "ci", "cd", "oop",
        "svm", "pca", "kl", "eda", "genai", "mlops", "qa", "gpu",
        "cpu", "rlhf", "lora", "qlora", "shap", "lime", "roc", "auc",
        "gans", "gan", "vae", "dnn", "agnt", "agi", "asi"
    }
    
    # Words to keep lowercase (unless first word)
    lowercase_words = {
        "a", "an", "the", "and", "but", "or", "for", "nor",
        "in", "on", "at", "to", "by", "of", "vs", "is", "with", "from"
    }
    
    words = text.split()
    result = []
    
    for i, word in enumerate(words):
        lower = word.lower()
        if lower in uppercase_words:
            result.append(word.upper())
        elif i > 0 and lower in lowercase_words:
            result.append(lower)
        else:
            result.append(word.capitalize())
    
    return " ".join(result)


def generate_description(title, phase_title):
    """Generate a basic description from the title and phase context."""
    return f"{title} — part of the {phase_title} curriculum."


def scan_phase_pdfs(phase_folder_path, phase_folder_name):
    """
    Scan a phase folder for PDF files and return sorted lesson list.
    """
    lessons = []
    
    if not os.path.isdir(phase_folder_path):
        return lessons
    
    for filename in os.listdir(phase_folder_path):
        if not filename.lower().endswith(".pdf"):
            continue
        
        parsed = parse_pdf_filename(filename)
        if parsed is None:
            print(f"  ⚠ Skipping '{filename}' — doesn't match naming convention (NN-title.pdf)")
            continue
        
        num, title = parsed
        pdf_path = f"pdfs/{phase_folder_name}/{filename}"
        
        lessons.append({
            "id": num,
            "title": title,
            "pdf": pdf_path,
            "filename": filename,
            "description": ""  # Will be filled later
        })
    
    # Sort by lesson number
    lessons.sort(key=lambda l: l["id"])
    return lessons


# ---------- Main ----------

def build():
    print("🧠 AI Meme University — Curriculum Builder")
    print("=" * 50)
    
    # Load phase config
    if not os.path.exists(PHASE_CONFIG_PATH):
        print(f"❌ Error: {PHASE_CONFIG_PATH} not found")
        sys.exit(1)
    
    with open(PHASE_CONFIG_PATH, "r", encoding="utf-8") as f:
        phase_configs = json.load(f)
    
    print(f"📋 Loaded {len(phase_configs)} phase configs")
    
    # Scan PDFs
    curriculum_data = []
    total_lessons = 0
    
    for config in phase_configs:
        folder = config["folder"]
        phase_path = os.path.join(PDFS_DIR, folder)
        
        print(f"\n📁 Scanning {folder}/...")
        lessons = scan_phase_pdfs(phase_path, folder)
        
        if not lessons:
            print(f"   (no PDFs found — phase will be included but empty)")
        
        # Fill in descriptions and duration
        for lesson in lessons:
            lesson["description"] = generate_description(lesson["title"], config["title"])
            lesson["duration"] = config.get("defaultDuration", "12 min")
            # Remove internal-only field
            del lesson["filename"]
            print(f"   ✓ PPT {str(lesson['id']).zfill(2)} — {lesson['title']}")
        
        phase_entry = {
            "id": folder,
            "phase": config["phase"],
            "title": config["title"],
            "shortTitle": config["shortTitle"],
            "icon": config["icon"],
            "description": config["description"],
            "memeOnComplete": config.get("memeOnComplete", "Lesson complete! 🧠"),
            "lessons": lessons
        }
        
        curriculum_data.append(phase_entry)
        total_lessons += len(lessons)
    
    # Generate JavaScript
    js_content = generate_js(curriculum_data)
    
    # Write output
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    print(f"\n{'=' * 50}")
    print(f"✅ Generated {OUTPUT_PATH}")
    print(f"   {len(curriculum_data)} phases, {total_lessons} lessons")
    print(f"\n💡 Tip: To add a new lesson, just drop a PDF into pdfs/phase-X/")
    print(f"   following the naming convention: NN-title-words.pdf")


def generate_js(curriculum_data):
    """Generate the complete curriculum.js file content."""
    
    # Pretty-print the data
    data_json = json.dumps(curriculum_data, indent=4, ensure_ascii=False)
    
    return f'''/**
 * curriculum.js — Single source of truth for AI Meme University
 * 
 * ⚠️  AUTO-GENERATED FILE — Do not edit manually!
 * 
 * This file is generated by build_curriculum.py from:
 *   - phase-config.json (phase metadata)
 *   - pdfs/ directory (PDF files)
 * 
 * To update: run `python build_curriculum.py` or push to GitHub.
 * 
 * NAMING CONVENTION FOR PDFs:
 *   pdfs/phase-X/NN-title-words-here.pdf
 *   Example: pdfs/phase-0/01-what-is-ai.pdf
 */

const curriculum = {data_json};

// Meme messages for various actions
const memeMessages = {{
    lessonComplete: [
        "Neuron successfully activated 🧠",
        "One step closer to AGI 🤖",
        "Knowledge gradient: updated ✅",
        "Loss function: decreasing 📉",
        "Training epoch complete 🔄"
    ],
    phaseComplete: [
        "Phase conquered. You're basically Andrej Karpathy now 😎",
        "Weights updated. Moving to the next layer 🧠",
        "Checkpoint saved. No going back now 💾"
    ],
    search: [
        "Cosine similarity search activated 🔍",
        "Retrieving relevant knowledge... 📚"
    ],
    welcome: [
        "Welcome back, fellow learner 🧠",
        "Your neural network missed you 🤖",
        "Resuming training from last checkpoint... 💾"
    ]
}};

// ==================== Utility Functions ====================

/** Get total lesson count across all phases */
function getTotalLessons() {{
    return curriculum.reduce((total, phase) => total + phase.lessons.length, 0);
}}

/** Flatten all lessons into a single ordered list */
function getAllLessons() {{
    const lessons = [];
    curriculum.forEach(phase => {{
        phase.lessons.forEach(lesson => {{
            lessons.push({{ ...lesson, phaseId: phase.id, phaseTitle: phase.title, phaseNum: phase.phase }});
        }});
    }});
    return lessons;
}}

/** Find a lesson by its global id */
function findLessonById(lessonId) {{
    lessonId = parseInt(lessonId);
    for (const phase of curriculum) {{
        for (const lesson of phase.lessons) {{
            if (lesson.id === lessonId) {{
                return {{ lesson, phase }};
            }}
        }}
    }}
    return null;
}}

/** Get previous and next lessons for navigation */
function getAdjacentLessons(lessonId) {{
    const allLessons = getAllLessons();
    const index = allLessons.findIndex(l => l.id === parseInt(lessonId));
    return {{
        prev: index > 0 ? allLessons[index - 1] : null,
        next: index < allLessons.length - 1 ? allLessons[index + 1] : null
    }};
}}

/** Get phase by id */
function getPhaseById(phaseId) {{
    return curriculum.find(p => p.id === phaseId) || null;
}}

// Make available globally
if (typeof window !== 'undefined') {{
    window.curriculum = curriculum;
    window.memeMessages = memeMessages;
    window.getTotalLessons = getTotalLessons;
    window.getAllLessons = getAllLessons;
    window.findLessonById = findLessonById;
    window.getAdjacentLessons = getAdjacentLessons;
    window.getPhaseById = getPhaseById;
}}
'''


if __name__ == "__main__":
    build()
