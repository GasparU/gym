# -*- coding: utf-8 -*-
"""Deja cada ingrediente de platos.json en UNA linea ({ "nombre": ..., "gramos": ... }).

Motivo: los scripts que reescriben el JSON con json.dumps(indent=2) lo expanden a 4
lineas por ingrediente. Eso rompe las anclas de las mutaciones (y hace el archivo
ilegible de un vistazo). Este script es idempotente y se corre antes de las mutaciones.
"""
import io
import json
import re

P = 'public/data/platos.json'
s = io.open(P, encoding='utf-8').read()
pat = re.compile(r'\{\s*\n\s*"nombre": ("(?:[^"\\]|\\.)*"),\s*\n\s*"gramos": (\d+)\s*\n\s*\}')
s2, n = pat.subn(lambda m: '{ "nombre": %s, "gramos": %s }' % (m.group(1), m.group(2)), s)
json.loads(s2)
io.open(P, 'w', encoding='utf-8', newline='').write(s2)
print('compactados %d ingredientes' % n)
