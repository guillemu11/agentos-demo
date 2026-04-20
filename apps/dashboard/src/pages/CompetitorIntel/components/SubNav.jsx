import { NavLink, useParams } from 'react-router-dom';

const LINKS = [
    { to: '',            label: 'Overview',     end: true },
    { to: 'comparative', label: 'Comparative' },
    { to: 'insights',    label: 'Insights' },
    { to: 'gap',         label: 'Emirates gap' },
];

export default function SubNav() {
    const { id } = useParams();
    if (!id) return null;
    return (
        <nav className="ci-subnav">
            {LINKS.map(l => {
                const path = l.to
                    ? `/app/competitor-intel/${id}/${l.to}`
                    : `/app/competitor-intel/${id}`;
                return (
                    <NavLink
                        key={l.label}
                        to={path}
                        end={l.end}
                        className={({ isActive }) => `ci-subnav-link${isActive ? ' is-active' : ''}`}
                    >
                        {l.label}
                    </NavLink>
                );
            })}
        </nav>
    );
}
