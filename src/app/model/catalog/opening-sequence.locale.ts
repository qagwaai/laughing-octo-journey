/**
 * Localized opening-sequence content contracts and locale library.
 */
export interface OpeningSequenceContent {
  sequenceTitle: string;
  eyebrow: string;
  phaseOneTitle: string;
  phaseOneDescription: string;
  phaseTwoTitle: string;
  phaseTwoDescription: string;
  phaseThreeTitle: string;
  systemChecks: string[];
  aiTransmission: string;
  hudTitle: string;
  aiLabel: string;
}

export interface OpeningSequenceLocaleBundle {
  variants: Record<string, OpeningSequenceContent>;
}

export const OPENING_SEQUENCE_LIBRARY: Record<string, OpeningSequenceLocaleBundle> = {
  en: {
    variants: {
      'cold-boot': {
        sequenceTitle: 'Opening Sequence: Cold Boot',
        eyebrow: 'Mission Bootstrap',
        phaseOneTitle: '1. The Blackout Phase',
        phaseOneDescription:
          'The screen is pitch black. The life-support pumps thrum in a rigid rhythm while heavy breathing cuts through the cabin noise.',
        phaseTwoTitle: '2. The First View',
        phaseTwoDescription:
          'The HUD sputters online. Through a cracked Tier 1 Scavenger Pod canopy, the Graveyard drifts by: fragmented hulls, severed spars, and cold wreckage crossing the silhouette of a dying blue sun.',
        phaseThreeTitle: '3. The AI Awakening',
        systemChecks: ['BIOS CHECK... OK', 'OXYGEN LEVELS... 18% (CRITICAL)', 'NEURAL LINK... ESTABLISHED'],
        aiTransmission:
          'Pilot, the Reactor Ship has been lost. We are drifting on residual battery. To survive, we must secure high-density matter for the Fabrication Unit. Deployment of the last Expendable unit is authorized.',
        hudTitle: 'COLD BOOT // TIER 1 SCAVENGER POD',
        aiLabel: 'AI LINK // DEGRADED CHANNEL',
      },
      'cold-boot-distress': {
        sequenceTitle: 'Opening Sequence: Cold Boot',
        eyebrow: 'Distress Bootstrap',
        phaseOneTitle: '1. The Blackout Phase',
        phaseOneDescription:
          'The cockpit remains black. Vent fans pulse in a failing cadence while your breathing is amplified through a damaged filter stack.',
        phaseTwoTitle: '2. The First View',
        phaseTwoDescription:
          'The HUD crawls online through static. The Graveyard hangs outside your cracked canopy while a pale blue sun silhouettes drifting ship carcasses.',
        phaseThreeTitle: '3. The AI Awakening',
        systemChecks: ['BIOS CHECK... DEGRADED MODE', 'OXYGEN LEVELS... 14% (CRITICAL)', 'NEURAL LINK... ESTABLISHED'],
        aiTransmission:
          'Pilot, telemetry confirms Reactor Ship destruction. Residual battery is collapsing. Prioritize high-density matter acquisition for Fabrication Unit continuity. Final Expendable authorization granted.',
        hudTitle: 'COLD BOOT // DISTRESS PROFILE',
        aiLabel: 'AI LINK // EMERGENCY CHANNEL',
      },
    },
  },
  it: {
    variants: {
      'cold-boot': {
        sequenceTitle: 'Sequenza iniziale: Cold Boot',
        eyebrow: 'Bootstrap missione',
        phaseOneTitle: '1. La fase del blackout',
        phaseOneDescription:
          'Lo schermo e completamente nero. Le pompe del supporto vitale pulsano con un ritmo rigido mentre un respiro pesante attraversa il rumore della cabina.',
        phaseTwoTitle: '2. La prima visuale',
        phaseTwoDescription:
          "L'HUD si riaccende a fatica. Attraverso la cappottina incrinata di uno Scavenger Pod di livello 1 scorre il Cimitero: scafi frammentati, travi spezzate e relitti gelidi davanti alla sagoma di un sole blu morente.",
        phaseThreeTitle: "3. Il risveglio dell'IA",
        systemChecks: [
          'CONTROLLO BIOS... OK',
          'LIVELLI OSSIGENO... 18% (CRITICO)',
          'COLLEGAMENTO NEURALE... STABILITO',
        ],
        aiTransmission:
          "Pilota, la nave reattore e andata perduta. Stiamo derivando con la batteria residua. Per sopravvivere dobbiamo mettere al sicuro materia ad alta densita per l'unita di fabbricazione. Autorizzato il dispiegamento dell'ultima unita Expendable.",
        hudTitle: 'COLD BOOT // SCAVENGER POD LIVELLO 1',
        aiLabel: 'COLLEGAMENTO IA // CANALE DEGRADATO',
      },
      'cold-boot-distress': {
        sequenceTitle: 'Sequenza iniziale: Cold Boot',
        eyebrow: 'Bootstrap di emergenza',
        phaseOneTitle: '1. La fase del blackout',
        phaseOneDescription:
          'Il cockpit resta al buio. Le ventole di sfiato pulsano con una cadenza in avaria mentre il tuo respiro viene amplificato attraverso un filtro danneggiato.',
        phaseTwoTitle: '2. La prima visuale',
        phaseTwoDescription:
          "L'HUD si avvia tra scariche statiche. Il Cimitero resta oltre la cappottina incrinata mentre un sole blu pallido staglia carcasse di navi alla deriva.",
        phaseThreeTitle: "3. Il risveglio dell'IA",
        systemChecks: [
          'CONTROLLO BIOS... MODALITA DEGRADATA',
          'LIVELLI OSSIGENO... 14% (CRITICO)',
          'COLLEGAMENTO NEURALE... STABILITO',
        ],
        aiTransmission:
          "Pilota, la telemetria conferma la distruzione della nave reattore. La batteria residua sta collassando. Dai priorita all'acquisizione di materia ad alta densita per garantire continuita all'unita di fabbricazione. Autorizzazione finale Expendable concessa.",
        hudTitle: 'COLD BOOT // PROFILO EMERGENZA',
        aiLabel: 'COLLEGAMENTO IA // CANALE DI EMERGENZA',
      },
    },
  },
};
