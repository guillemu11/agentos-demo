import React from 'react';
import PipelineBoard from './PipelineBoard';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function DepartmentKanban({ departments, getDeptTheme }) {
    const { t } = useLanguage();

    if (!departments || departments.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', opacity: 0.5, padding: '48px 24px' }}>
                <p>{t('departmentKanban.noDepartments')}</p>
            </div>
        );
    }

    return (
        <div className="kanban-departments-container">
            {departments.map(dept => (
                <section key={dept} className={`dept-section ${getDeptTheme(dept)}`}>
                    <h2 className="dept-title">{dept}</h2>
                    <div className="dept-kanban-board">
                        <PipelineBoard department={dept} />
                    </div>
                </section>
            ))}
        </div>
    );
}
