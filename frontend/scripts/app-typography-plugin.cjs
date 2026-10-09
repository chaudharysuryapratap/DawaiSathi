// Route app-owned Text/TextInput imports through scalable primitives. Third-party
// packages and the primitives themselves retain React Native's original exports.
module.exports = function ({ types: t }) {
  return { visitor: { ImportDeclaration(p, state) {
    const file = (state.filename || '').replace(/\\/g, '/');
    if (!/\/(app|src)\//.test(file) || file.includes('/node_modules/') || file.endsWith('/app-typography.tsx') || p.node.source.value !== 'react-native' || p.node.importKind === 'type') return;
    const moved = p.node.specifiers.filter(s => t.isImportSpecifier(s) && ['Text','TextInput'].includes(s.imported.name) && s.importKind !== 'type');
    if (!moved.length) return;
    p.node.specifiers = p.node.specifiers.filter(s => !moved.includes(s));
    p.insertAfter(t.importDeclaration(moved, t.stringLiteral('@/src/components/ui/app-typography')));
  } } };
};
