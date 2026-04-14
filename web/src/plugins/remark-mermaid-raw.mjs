/**
 * Remark plugin: replaces ```mermaid code blocks with anchor placeholders.
 * A client-side script teleports interactive React components into these slots.
 * Each slot gets a sequential data-diagram-index attribute.
 */
let diagramCounter = 0;

export default function remarkMermaidRaw() {
  return (tree) => {
    diagramCounter = 0;
    walkTree(tree);
  };
}

function walkTree(node) {
  if (!node.children) return;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (child.type === 'code' && child.lang === 'mermaid') {
      const index = diagramCounter++;
      node.children[i] = {
        type: 'html',
        value: `<div class="diagram-slot" data-diagram-index="${index}"></div>`,
      };
    } else {
      walkTree(child);
    }
  }
}
