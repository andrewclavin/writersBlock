import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LexiconMergingChip } from './LexiconMergingChip';

export type LexiconDrawerEntry = {
  entryKey: string;
  display: string;
  remaining: number;
  isPhrase: boolean;
};

type LexiconLetterSectionProps = {
  letter: string;
  itemsForLetter: LexiconDrawerEntry[];
  expanded: boolean;
  onToggleLetter: (letter: string) => void;
  selectedLexiconKey: string | null;
  onLexiconChipTap: (entryKey: string) => void;
  registerTarget: (key: string, node: View | null) => void;
  onDragEnd: (fromKey: string, absoluteX: number, absoluteY: number) => void;
  registerCascadeAnchor?: (key: string, node: View | null) => void;
  collapseCascadeEntryKey?: string | null;
  cascadePreviewKeys?: ReadonlySet<string> | null;
  cascadeHideCharByKey?: ReadonlyMap<string, number> | null;
  cascadeGlowByKey?: ReadonlyMap<string, number> | null;
};

export function LexiconLetterSection({
  letter,
  itemsForLetter,
  expanded,
  onToggleLetter,
  selectedLexiconKey,
  onLexiconChipTap,
  registerTarget,
  onDragEnd,
  registerCascadeAnchor,
  collapseCascadeEntryKey,
  cascadePreviewKeys,
  cascadeHideCharByKey,
  cascadeGlowByKey,
}: LexiconLetterSectionProps) {
  const sortedItems = useMemo(() => {
    const list = [...itemsForLetter];
    if (expanded) {
      return list.sort((a, b) => a.display.localeCompare(b.display));
    }
    return list.sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return a.display.localeCompare(b.display);
    });
  }, [itemsForLetter, expanded]);

  const previewItems = sortedItems.slice(0, 3);
  const displayItems = expanded ? sortedItems : previewItems;
  const overflow = itemsForLetter.length - previewItems.length;

  if (itemsForLetter.length === 0) return null;

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <View style={styles.letterCol}>
          <Pressable
            onPress={() => onToggleLetter(letter)}
            style={({ pressed }) => [styles.letterBtn, pressed && styles.letterBtnPressed]}>
            <Text style={styles.letterText}>{letter}</Text>
          </Pressable>
          {!expanded && (
            <Ionicons
              name="chevron-down"
              size={12}
              color="#9CA3AF"
              style={styles.letterChevron}
            />
          )}
        </View>
        <View style={styles.chips}>
          {!expanded ? (
            <>
              {previewItems.map((item) => (
                <LexiconMergingChip
                  key={item.entryKey}
                  entryKey={item.entryKey}
                  display={item.display}
                  remaining={item.remaining}
                  isPhrase={item.isPhrase}
                  selected={selectedLexiconKey === item.entryKey}
                  onChipTap={() => onLexiconChipTap(item.entryKey)}
                  registerTarget={registerTarget}
                  onDragEnd={onDragEnd}
                  registerCascadeAnchor={registerCascadeAnchor}
                  collapseCascadeEntryKey={collapseCascadeEntryKey}
                  cascadePreviewKeys={cascadePreviewKeys}
                  cascadeHideCharByKey={cascadeHideCharByKey}
                  cascadeGlowByKey={cascadeGlowByKey}
                />
              ))}
              {overflow > 0 && <Text style={styles.more}>+{overflow}</Text>}
            </>
          ) : (
            displayItems.slice(0, Math.min(3, displayItems.length)).map((item) => (
              <LexiconMergingChip
                key={item.entryKey}
                entryKey={item.entryKey}
                display={item.display}
                remaining={item.remaining}
                isPhrase={item.isPhrase}
                selected={selectedLexiconKey === item.entryKey}
                onChipTap={() => onLexiconChipTap(item.entryKey)}
                registerTarget={registerTarget}
                onDragEnd={onDragEnd}
                registerCascadeAnchor={registerCascadeAnchor}
                collapseCascadeEntryKey={collapseCascadeEntryKey}
                cascadePreviewKeys={cascadePreviewKeys}
                cascadeHideCharByKey={cascadeHideCharByKey}
                cascadeGlowByKey={cascadeGlowByKey}
              />
            ))
          )}
        </View>
      </View>
      {expanded && displayItems.length > 3 && (
        <View style={styles.expandedRow}>
            {displayItems.slice(3).map((item) => (
            <LexiconMergingChip
              key={item.entryKey}
              entryKey={item.entryKey}
              display={item.display}
              remaining={item.remaining}
              isPhrase={item.isPhrase}
              selected={selectedLexiconKey === item.entryKey}
              onChipTap={() => onLexiconChipTap(item.entryKey)}
              registerTarget={registerTarget}
              onDragEnd={onDragEnd}
              registerCascadeAnchor={registerCascadeAnchor}
              collapseCascadeEntryKey={collapseCascadeEntryKey}
              cascadePreviewKeys={cascadePreviewKeys}
              cascadeHideCharByKey={cascadeHideCharByKey}
              cascadeGlowByKey={cascadeGlowByKey}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  letterCol: {
    width: 40,
    alignItems: 'center',
  },
  letterBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterBtnPressed: {
    opacity: 0.7,
  },
  letterText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  letterChevron: {
    marginTop: -2,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  more: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 8,
  },
  expandedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 52,
  },
});
