import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

/**
 * PipelineStepsTimeline — right column of Image Studio.
 * Vertical list of pipeline steps with pending/active/done/failed states.
 */
const STEP_KEYS_BY_MODE = {
  typographic: ['planning', 'planReady', 'rendering', 'encoding', 'persisting', 'done'],
  slideshow: ['planning', 'planReady', 'rendering', 'encoding', 'persisting', 'done'],
  veo: ['planning', 'planReady', 'rendering', 'encoding', 'persisting', 'done'],
  image: ['planning', 'planReady', 'generating', 'persisting', 'done'],
};

export default function PipelineStepsTimeline({ mode, completedSteps, activeStep, failedStep }) {
  const { t } = useLanguage();
  const steps = STEP_KEYS_BY_MODE[mode] || STEP_KEYS_BY_MODE.typographic;

  return (
    <div className="pipeline-timeline">
      {steps.map((stepKey, i) => {
        let status = 'pending';
        if (failedStep === stepKey) status = 'failed';
        else if (completedSteps.includes(stepKey)) status = 'done';
        else if (activeStep === stepKey) status = 'active';

        const marker =
          status === 'done' ? '✓' :
          status === 'failed' ? '✗' :
          status === 'active' ? '' :
          i + 1;

        return (
          <div key={stepKey} className={`pipeline-step pipeline-step-${status}`}>
            <span className="pipeline-step-marker">{marker}</span>
            <span className="pipeline-step-label">{t(`imageStudio.steps.${stepKey}`)}</span>
          </div>
        );
      })}
    </div>
  );
}
