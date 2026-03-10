import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { CheckCircle2, Circle, Radio } from 'lucide-react';

export default function ProjectQueue({ projects, currentIndex, discussedIndices }) {
    const { t } = useLanguage();
    const discussed = new Set(discussedIndices || []);

    return (
        <div className="mab-project-queue">
            <span className="mab-queue-label">{t('multiBrainstorm.projectsQueue')}</span>
            <div className="mab-queue-strip">
                {projects.map((project, idx) => {
                    const isActive = idx === currentIndex;
                    const isDone = discussed.has(idx);
                    const status = isDone ? 'discussed' : isActive ? 'active' : 'pending';

                    return (
                        <div
                            key={idx}
                            className={`mab-project-card mab-project-${status}`}
                            title={project.title || project.name}
                        >
                            <span className="mab-project-icon">
                                {isDone ? <CheckCircle2 size={14} /> :
                                 isActive ? <Radio size={14} /> :
                                 <Circle size={14} />}
                            </span>
                            <span className="mab-project-title">
                                {project.title || project.name}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
