import { parseOrvi } from "../src/parser";
import { renderOrvi } from "../src/renderer";
import { formatOrvi } from "../src/formatter";
import { walk } from "../src/walk";
import type { ListNode } from "../src/ast";

// Nested lists, block content in items, loose/tight, ordered `start`, and task
// lists — added in orvi-lang 2.0 (spec 0.4).

function roundTrips(source: string): void {
  expect(parseOrvi(source).diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const formatted = formatOrvi(source).formatted;
  expect(formatOrvi(source).diagnostics.filter((d) => d.code.startsWith("ORVI_FORMAT_"))).toEqual([]);
  expect(renderOrvi(formatted).html).toBe(renderOrvi(source).html);
  expect(formatOrvi(formatted).formatted).toBe(formatted);
}

describe("list AST shape", () => {
  it("items are ListItemNodes with block children", () => {
    const list = parseOrvi("- a\n- b").children[0] as ListNode;
    expect(list.type).toBe("list");
    expect(list.items.map((i) => i.type)).toEqual(["listItem", "listItem"]);
    expect(list.items[0]!.children[0]?.type).toBe("paragraph");
  });
});

describe("flat tight lists stay byte-identical to before", () => {
  it("renders a tight item's inline content with no <p> wrapper", () => {
    expect(renderOrvi("- **a**\n- b").html).toContain(
      '<ul class="orvi-list"><li><strong>a</strong></li><li>b</li></ul>'
    );
    expect(renderOrvi("1. one\n2. two").html).toContain('<ol class="orvi-list"><li>one</li><li>two</li></ol>');
  });
});

describe("nested lists", () => {
  it("nests by indentation", () => {
    expect(renderOrvi("- top\n  - child\n- back").html).toContain(
      '<ul class="orvi-list"><li>top\n<ul class="orvi-list"><li>child</li></ul></li><li>back</li></ul>'
    );
  });

  it("nests three deep and round-trips", () => {
    roundTrips("- a\n  - b\n    - c\n");
  });

  it("mixes ordered inside unordered", () => {
    roundTrips("- a\n  1. one\n  2. two\n- b\n");
  });

  it("expands a leading tab to spaces", () => {
    expect(renderOrvi("- a\n\t- b").html).toBe(renderOrvi("- a\n    - b").html);
  });
});

describe("loose vs tight", () => {
  it("a blank line between items makes the list loose (<p>-wrapped)", () => {
    expect(renderOrvi("- a\n\n- b").html).toContain('<li><p>a</p></li><li><p>b</p></li>');
    const loose = parseOrvi("- a\n\n- b").children[0] as ListNode;
    expect(loose.loose).toBe(true);
  });

  it("keeps a no-blank list tight", () => {
    const tight = parseOrvi("- a\n- b").children[0] as ListNode;
    expect(tight.loose).toBeUndefined();
  });

  it("a multi-paragraph item is loose and round-trips", () => {
    roundTrips("- first\n\n  second\n\n- next\n");
  });
});

describe("ordered start", () => {
  it("keeps the first number as `start` and renders <ol start>", () => {
    const list = parseOrvi("3. three\n4. four").children[0] as ListNode;
    expect(list.start).toBe(3);
    expect(renderOrvi("3. three\n4. four").html).toContain('<ol class="orvi-list" start="3">');
    roundTrips("3. three\n4. four\n");
  });

  it("omits start for a list beginning at 1", () => {
    const list = parseOrvi("1. a\n2. b").children[0] as ListNode;
    expect(list.start).toBeUndefined();
  });
});

describe("task lists", () => {
  it("parses `[ ]`/`[x]` into a task flag and renders an accessible checkbox", () => {
    const list = parseOrvi("- [ ] todo\n- [x] done").children[0] as ListNode;
    expect(list.items.map((i) => i.task)).toEqual([false, true]);
    const html = renderOrvi("- [ ] todo\n- [x] done").html;
    expect(html).toContain('<ul class="orvi-list orvi-task-list">');
    expect(html).toContain('<input class="orvi-task-box" type="checkbox" disabled aria-label="To do"> todo');
    expect(html).toContain('<input class="orvi-task-box" type="checkbox" disabled checked aria-label="Completed"> done');
    roundTrips("- [ ] todo\n- [x] done\n");
  });

  it("allows tasks on ordered lists", () => {
    roundTrips("1. [x] first\n2. [ ] second\n");
  });

  it("does not treat a non-task `[…]` as a task", () => {
    const list = parseOrvi("- [link](https://e.com) text").children[0] as ListNode;
    expect(list.items[0]!.task).toBeUndefined();
    expect(renderOrvi("- [link](https://e.com) here").html).toContain('<a class="orvi-link"');
  });
});

describe("block content in items + walk + diagnostics", () => {
  it("an item can contain a heading, code, and a blockquote", () => {
    roundTrips("- ## Title\n\n  text\n\n  ```js\n  const x = 1;\n  ```\n\n  > quote\n");
  });

  it("walk traverses list items and their block children", () => {
    const seen: string[] = [];
    walk(parseOrvi("- a\n  - b"), (n) => seen.push(n.type));
    expect(seen.filter((t) => t === "listItem")).toHaveLength(2);
    expect(seen).toEqual(expect.arrayContaining(["list", "listItem", "paragraph"]));
  });

  it("warns when irregular indentation would merge adjacent same-type sub-lists", () => {
    const result = formatOrvi("- a\n    - b\n  - c\n");
    expect(result.diagnostics.map((d) => d.code)).toContain("ORVI_FORMAT_LIST_AMBIGUOUS_NESTING");
  });

  it("does not hang on a tab-indented list inside a blockquote", () => {
    // A tab after `>` (not at line start) used to escape tab expansion, making
    // the list parser disagree on indentation and loop forever.
    const start = Date.now();
    const ast = parseOrvi("> \t- x");
    expect(Date.now() - start).toBeLessThan(1000);
    expect(ast.children[0]?.type).toBe("blockquote");
  });

  it("caps deeply nested lists instead of overflowing", () => {
    let src = "";
    for (let i = 0; i < 400; i += 1) src += `${"  ".repeat(i)}- x\n`;
    const ast = parseOrvi(src);
    expect(ast.diagnostics.map((d) => d.code)).toContain("ORVI_MAX_NESTING_DEPTH");
    expect(Array.isArray(ast.children)).toBe(true);
  });
});
