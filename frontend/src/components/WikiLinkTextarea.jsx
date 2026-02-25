import { useMemo, useState } from "react";
import { getActiveWikiLinkQuery, rankPageMatches } from "../utils/pageData.js";

export default function WikiLinkTextarea({ label, rows, value, onChange, pageIndex }) {
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const activeQuery = useMemo(
    () => getActiveWikiLinkQuery(value, cursorPosition),
    [value, cursorPosition]
  );

  const matches = useMemo(() => {
    if (!activeQuery) {
      return [];
    }
    return rankPageMatches(pageIndex, activeQuery, 6);
  }, [activeQuery, pageIndex]);

  const showHints = isFocused && activeQuery !== null;

  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => {
          onChange(event);
          setCursorPosition(event.target.selectionStart ?? event.target.value.length);
        }}
        onClick={(event) => setCursorPosition(event.target.selectionStart ?? value.length)}
        onKeyUp={(event) => setCursorPosition(event.currentTarget.selectionStart ?? value.length)}
        onSelect={(event) => setCursorPosition(event.currentTarget.selectionStart ?? value.length)}
        onFocus={(event) => {
          setIsFocused(true);
          setCursorPosition(event.target.selectionStart ?? value.length);
        }}
        onBlur={() => setIsFocused(false)}
      />
      {showHints ? (
        <div className="wikilink-hints">
          <p className="wikilink-hints-title">
            Checking link target for <code>[[{activeQuery || "..."}]]</code>
          </p>
          {activeQuery ? (
            matches.length ? (
              <ul className="wikilink-hints-list">
                {matches.map((item) => (
                  <li key={item.id}>{item.title}</li>
                ))}
              </ul>
            ) : (
              <p className="wikilink-hints-empty">No page title matches that link target.</p>
            )
          ) : (
            <p className="wikilink-hints-empty">Start typing after <code>[[</code> to validate links.</p>
          )}
        </div>
      ) : null}
    </label>
  );
}
