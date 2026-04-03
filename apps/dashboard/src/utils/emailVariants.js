// apps/dashboard/src/utils/emailVariants.js

/**
 * Sustituye variables SFMC (%%=v(@var)=%%) con valores reales de una variante.
 * @param {string} html  - HTML de la template con variables SFMC
 * @param {object} variant - objeto { heroHeadline, preheader, cta, bodyCopy } con shape { status, value }
 * @returns {string} HTML con variables sustituidas
 */
export function substituteVariants(html, variant) {
  if (!html || !variant) return html || '';
  return html
    .replace(/%%=v\(@main_header\)=%%/g,  variant.heroHeadline?.value ?? '[[main_header]]')
    .replace(/%%=v\(@preheader\)=%%/g,    variant.preheader?.value    ?? '[[preheader]]')
    .replace(/%%=v\(@main_cta\)=%%/g,     variant.cta?.value          ?? '[[main_cta]]')
    .replace(/%%=v\(@body_copy\)=%%/g,    variant.bodyCopy?.value     ?? '[[body_copy]]');
}

/**
 * Cuenta cuántos campos de una variante están aprobados.
 */
export function countApproved(variant) {
  if (!variant) return 0;
  return Object.values(variant).filter(f => f?.status === 'approved').length;
}

/** Total de campos por variante */
export const FIELDS_PER_VARIANT = 5;
