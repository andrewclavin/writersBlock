import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { promptClearGameProgress } from '@/components/game/promptClearGameProgress';

type PlaySessionMenuProps = {
  top: number;
  right: number;
  onClearProgress: () => void;
  /** Dev: session snapshot undo (move vs cascade are separate steps). */
  canDevUndo?: boolean;
  canDevRedo?: boolean;
  onDevUndo?: () => void;
  onDevRedo?: () => void;
};

export function PlaySessionMenu({
  top,
  right,
  onClearProgress,
  canDevUndo = false,
  canDevRedo = false,
  onDevUndo,
  onDevRedo,
}: PlaySessionMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const go = (href: '/' | '/explore') => {
    close();
    router.push(href);
  };

  return (
    <View style={[styles.anchor, { top, right }]}>
      <Pressable
        accessibilityLabel="Open menu"
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
        <Ionicons name="menu" size={24} color="#374151" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={[styles.sheetWrap, { top: top + 48, right }]} pointerEvents="box-none">
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Navigate</Text>
              <Pressable style={styles.row} onPress={() => go('/')}>
                <Ionicons name="home-outline" size={20} color="#374151" />
                <Text style={styles.rowLabel}>Home</Text>
              </Pressable>
              <Pressable style={styles.row} onPress={() => go('/explore')}>
                <Ionicons name="paper-plane-outline" size={20} color="#374151" />
                <Text style={styles.rowLabel}>Explore</Text>
              </Pressable>

              {onDevUndo ? (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sheetTitle}>Dev</Text>
                  <Pressable
                    style={styles.row}
                    disabled={!canDevUndo}
                    onPress={() => {
                      if (!canDevUndo || !onDevUndo) return;
                      close();
                      onDevUndo();
                    }}>
                    <Ionicons
                      name="arrow-undo-outline"
                      size={20}
                      color={canDevUndo ? '#374151' : '#D1D5DB'}
                    />
                    <Text
                      style={[styles.rowLabel, !canDevUndo && styles.rowLabelDisabled]}>
                      Undo (move / cascade)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.row}
                    disabled={!canDevRedo}
                    onPress={() => {
                      if (!canDevRedo || !onDevRedo) return;
                      close();
                      onDevRedo();
                    }}>
                    <Ionicons
                      name="arrow-redo-outline"
                      size={20}
                      color={canDevRedo ? '#374151' : '#D1D5DB'}
                    />
                    <Text
                      style={[styles.rowLabel, !canDevRedo && styles.rowLabelDisabled]}>
                      Redo
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <View style={styles.divider} />

              <Pressable
                style={styles.row}
                onPress={() => {
                  close();
                  promptClearGameProgress(onClearProgress);
                }}>
                <Ionicons name="trash-outline" size={20} color="#B45309" />
                <Text style={[styles.rowLabel, styles.destructiveLabel]}>Clear game progress</Text>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    zIndex: 100,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    elevation: 16,
  },
  iconBtnPressed: {
    opacity: 0.75,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheetWrap: {
    position: 'absolute',
    alignItems: 'flex-end',
  },
  sheet: {
    minWidth: 220,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 24,
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingBottom: 6,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowLabel: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  destructiveLabel: {
    color: '#B45309',
  },
  rowLabelDisabled: {
    color: '#D1D5DB',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 4,
    marginHorizontal: 12,
  },
});
