// I display the in-app notifications inbox from Firestore with pull-to-refresh and mark-as-read.
// Ref: Array filter - https://www.w3schools.com/jsref/jsref_filter.asp
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, TouchableOpacity, View as RNView } from 'react-native';
import { auth, db } from '../FirebaseConfig';
import { Text } from '../components/Themed';
import { AppBadge, AppCard, useAppTheme } from '../components/ui';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { AppNotification, markNotificationRead, NOTIFICATIONS_COLLECTION } from '../components/lib/notifications';

export default function NotificationsScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const uid = auth.currentUser?.uid ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items]);

  const load = async () => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      setLoadError(null);
      return;
    }

    try {
      setLoadError(null);
      let snap;
      try {
        // Preferred (ordered) query — may require a composite index.
        snap = await getDocs(
          query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where('toUserId', '==', uid),
            orderBy('createdAt', 'desc'),
            limit(50)
          )
        );
      } catch (e: any) {
        const msg = String(e?.message ?? '');
        const code = String(e?.code ?? '');
        const needsIndex =
          code === 'failed-precondition' ||
          msg.toLowerCase().includes('requires an index');

        if (!needsIndex) {
          throw e;
        }

        // Fallback: no composite index required. I sort client-side.
        snap = await getDocs(
          query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where('toUserId', '==', uid),
            limit(50)
          )
        );
      }

      const rows: AppNotification[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          toUserId: data.toUserId,
          title: data.title,
          body: data.body,
          createdAt: data.createdAt,
          readAt: data.readAt ?? null,
          sentBy: data.sentBy ?? null,
          leagueId: data.leagueId ?? null,
          type: data.type ?? null,
          data: data.data ?? null,
        };
      });

      // If the fallback query was used, I sort by createdAt client-side.
      rows.sort((a, b) => {
        const aMs = (a.createdAt?.toMillis?.() ?? 0) as number;
        const bMs = (b.createdAt?.toMillis?.() ?? 0) as number;
        return bMs - aMs;
      });

      setItems(rows);
    } catch (e: any) {
      const msg = String(e?.message ?? 'Failed to load notifications.');
      setLoadError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onOpen = async (n: AppNotification) => {
    if (!n.readAt) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: { toMillis: () => Date.now() } as any } : x)));
    }

    if (n.leagueId) {
      router.push({ pathname: '/league/[leagueId]' as any, params: { leagueId: n.leagueId } as any });
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: true,
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
        <RNView style={{ padding: 20, paddingBottom: 30, gap: 12 }}>
          <AppCard>
            <RNView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 20, fontWeight: '900' }}>Inbox</Text>
              {unreadCount > 0 ? <AppBadge text={`${String(unreadCount)} unread`} tone="warning" /> : <AppBadge text="All read" tone="success" />}
            </RNView>
            <Text style={{ marginTop: 8, color: t.colors.mutedText, fontWeight: '600' }}>
              These are in-app notifications. In Expo Go, alerts only appear while the app is open.
            </Text>
          </AppCard>

          {loading ? (
            <RNView style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator color={t.colors.tint} />
              <Text style={{ marginTop: 10, color: t.colors.mutedText, fontWeight: '700' }}>Loading…</Text>
            </RNView>
          ) : loadError ? (
            <AppCard>
              <Text style={{ fontSize: 16, fontWeight: '900' }}>Could not load inbox</Text>
              <Text style={{ marginTop: 8, color: t.colors.mutedText, fontWeight: '600' }}>
                {loadError}
              </Text>
              <Text style={{ marginTop: 10, color: t.colors.mutedText, fontWeight: '600' }}>
                If the message says “requires an index”, open the Firestore index link in the error and create it.
              </Text>
            </AppCard>
          ) : items.length === 0 ? (
            <AppCard>
              <Text style={{ fontSize: 16, fontWeight: '900' }}>No notifications yet</Text>
              <Text style={{ marginTop: 8, color: t.colors.mutedText, fontWeight: '600' }}>
                When an admin sends an update, it will show up here.
              </Text>
            </AppCard>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              scrollEnabled={true}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.tint} />}
              ItemSeparatorComponent={() => <RNView style={{ height: 12 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => onOpen(item)} activeOpacity={0.9}>
                  <AppCard>
                    <RNView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <RNView style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '900' }}>{item.title}</Text>
                        <Text style={{ marginTop: 6, color: t.colors.mutedText, fontWeight: '600' }}>{item.body}</Text>
                      </RNView>
                      {!item.readAt ? <AppBadge text="New" tone="warning" /> : <AppBadge text="Read" tone="success" />}
                    </RNView>
                    {item.leagueId ? (
                      <Text style={{ marginTop: 10, color: t.colors.mutedText, fontWeight: '700' }}>
                        Tap to open league
                      </Text>
                    ) : null}
                  </AppCard>
                </TouchableOpacity>
              )}
            />
          )}
        </RNView>
      </SafeAreaView>
    </>
  );
}

