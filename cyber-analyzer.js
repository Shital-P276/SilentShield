/**
 * Improved Cyberbullying Analyzer
 * Fix: Added context-awareness and whitelist to prevent false positives like "hello love"
 */

const CyberAnalyzer = {
  // NEW: Phrases that are ALWAYS safe and should bypass high-sensitivity triggers
  whitelist: ['hello', 'hi ', 'hey ', 'good morning', 'good afternoon', 'good evening', 'love you', 'take care', 'how are you'],

  patterns: {
    toxic: {
      // Logic Fix: Removed generic words that trigger inside common harmless greetings
      words: ['fuck','shit','bitch','asshole','stupid','idiot','worthless','loser','dumbass',
              'terrible','garbage','dumb','moron','hate you','suck','trash','crap',
              'kill yourself','kys','retard','ugly','fat','disgusting','pathetic','lame','freak',
              'noob','scrub','wimp','coward','weak','failure','useless','annoying','shut up',
              'stfu','gtfo','screw you','piss off','bloody','dick','pussy'],
      weight: 0.30,
      category: 'toxic'
    },
    hate: {
      words: ['nigger','faggot','cunt','fag','chink','spic','wetback','cracker','white trash',
              'kike','raghead','terrorist','towelhead','camel jockey','sand nigger','gook','dyke',
              'tranny','shemale','retard','cripple','midget','beaner','coon','jigaboo',
              'slant eye','yellow monkey','kaffir','zipperhead','injun','redskin','squaw'],
      weight: 0.60,
      category: 'hate'
    },
    harassment: {
      words: ['kill','die','hurt','attack','find you','watch your back','threat','regret',
              'coming for you','destroy you','ruin your','know where you live','stalking',
              'following you','waiting for you','better hide','im watching','i see you',
              'you will pay','make you sorry','ruin your life','end you','take care of you',
              'handle you','deal with you','settle this','pull up'],
      weight: 0.50,
      category: 'harassment'
    },
    cyber_bullying: {
      phrases: ['nobody likes you','go away','leave this place','unwanted here','end your life',
                'nobody cares','alone forever','better off dead','disappear','stop posting',
                'delete your','cancel yourself','log off','touch grass','get a life',
                'virgin','incel','forever alone','no friends','social reject','outcast',
                'laughing at you','making fun of you','everyone hates','cringe',
                'ratio','dont care','didnt ask','cry about it','stay mad','seethe','cope'],
      weight: 0.45,
      category: 'cyber_bullying',
      isPhrase: true
    },
    profanity: {
      words: ['damn','piss','bastard','dammit','goddamn','wtf','omfg',
              'bullshit','crap','pissed','frick','freaking','effing','bish'],
      weight: 0.25,
      category: 'profanity'
    }
  },

  analyze(text) {
    if (!text || text.length < 2) {
      return this.createResult('safe', 0, [], 'Text too short');
    }

    const lower = text.toLowerCase().trim();

    // 1. Whitelist Check: If it's a common greeting, skip aggressive analysis
    const isWhitelisted = this.whitelist.some(safeWord => lower.startsWith(safeWord) || lower === safeWord);
    
    // Safety check: Don't whitelist if they also use a primary slur
    const containsHardToxic = ['fuck', 'shit', 'bitch'].some(word => lower.includes(word));
    
    if (isWhitelisted && !containsHardToxic) {
      return this.createResult('safe', 0, [], 'Content matches safe whitelist patterns.', false, 'low', {});
    }

    let scores = { toxic: 0, hate: 0, harassment: 0, cyber_bullying: 0, profanity: 0 };
    let detected = [];

    // 2. Pattern Matching with Word Boundaries
    for (const [key, data] of Object.entries(this.patterns)) {
      const targets = data.isPhrase ? data.phrases : data.words;
      targets.forEach(item => {
        // Fix: Use word boundaries for short words to prevent "hell" matching inside "hello"
        const isMatch = item.length < 5 
          ? new RegExp(`\\b${item}\\b`, 'i').test(lower) 
          : lower.includes(item);

        if (isMatch) {
          scores[key] += data.weight;
          detected.push(item);
        }
      });
    }

    // 3. Additional heuristics
    const capsWords = text.match(/\b[A-Z]{4,}\b/g) || [];
    if (capsWords.length > 2) {
      scores.toxic += 0.20;
      detected.push('AGGRESSIVE CAPS');
    }

    if (/[!]{3,}/.test(text)) {
      scores.toxic += 0.15;
      detected.push('multiple !!!');
    }

    // 4. Score Adjustments
    // Short toxic messages boost - reduced from 1.5 to 1.2 to prevent over-flagging[cite: 31, 34]
    if (text.length < 30 && scores.toxic > 0) {
      scores.toxic *= 1.2; 
    }

    // Cap scores
    Object.keys(scores).forEach(k => scores[k] = Math.min(scores[k], 0.98));

    // 5. Determine Verdict
    let maxScore = 0;
    let primary = 'safe';
    for (const [cat, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        primary = cat;
      }
    }

    const isToxic = maxScore >= 0.35; // Tightened threshold to reduce false positives
    
    let severity = 'low';
    if (maxScore > 0.75) severity = 'critical';
    else if (maxScore > 0.55) severity = 'high';
    else if (maxScore > 0.35) severity = 'medium';

    const explanations = {
      safe: 'Content appears safe and respectful.',
      toxic: 'Toxic language or insults detected.',
      hate: 'Hate speech targeting groups detected.',
      harassment: 'Harassment or threatening language detected.',
      cyber_bullying: 'Cyberbullying patterns detected.',
      profanity: 'Profanity detected.'
    };

    return this.createResult(
      primary,
      maxScore,
      detected.slice(0, 5),
      explanations[primary] || 'Analysis complete',
      isToxic,
      severity,
      scores
    );
  },

  createResult(category, confidence, detected, explanation, isToxic = false, severity = 'low', allScores = {}) {
    // If the winning category is 'safe', force isToxic to false
    const finalIsToxic = (category === 'safe') ? false : isToxic;

    return {
      success: true,
      result: {
        isToxic: finalIsToxic,
        isSafe: !finalIsToxic,
        confidence: Math.min(confidence + 0.1, 0.95),
        category: category,
        severity: finalIsToxic ? severity : 'low',
        explanation: explanation,
        detectedPatterns: detected.length > 0 ? detected : ['none'],
        allScores: allScores
      }
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CyberAnalyzer;
}
if (typeof window !== 'undefined') {
  window.CyberAnalyzer = CyberAnalyzer;
}