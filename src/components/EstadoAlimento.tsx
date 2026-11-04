import React from 'react';

/**
 * Etiqueta CRUDO / COCIDO de un alimento.
 * Existe para que el usuario no tenga que recordar en que estado peso la comida:
 * la etiqueta y el peso tienen que hablar el mismo idioma.
 */
export const EstadoAlimento: React.FC<{ esCocido: boolean }> = ({ esCocido }) => (
  <span
    className={`text-[10px] border px-1.5 py-0.5 rounded uppercase font-semibold ${
      esCocido
        ? 'bg-amber-900/60 text-amber-300 border-amber-700/50'
        : 'bg-blue-900/60 text-blue-300 border-blue-700/50'
    }`}
  >
    {esCocido ? 'Cocido' : 'Crudo'}
  </span>
);
