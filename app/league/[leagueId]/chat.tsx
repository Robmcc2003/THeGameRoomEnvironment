// display the league group chat and let members send and receive messages in real time.
// Ref: League chat UI - https://chatgpt.com/share/698628e4-3c08-8007-a920-17997d00bfde
// Ref: React useState - https://www.w3schools.com/react/react_usestate.asp
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../../../FirebaseConfig';
import { sendLeagueMessage, subscribeToLeagueMessages, type ChatMessage } from '../../../components/lib/chat';
import { Timestamp } from 'firebase/firestore';
import { useColorScheme } from '../../../components/useColorScheme';
import Colors from '../../../constants/Colors';
import { AppButton, AppCard, useAppTheme } from '../../../components/ui';

export default function LeagueChatScreen() {
  const params = useLocalSearchParams();
  const leagueId = Array.isArray(params.leagueId) ? params.leagueId[0] : (params.leagueId as string | undefined);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const t = useAppTheme();
  const tint = Colors[colorScheme].tint;
  const cardBg = colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF';
  const borderColor = colorScheme === 'dark' ? '#38383A' : '#E5E5EA';
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';

  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!leagueId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToLeagueMessages(leagueId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
      // Auto-scroll to bottom when new messages arrive
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsubscribe();
  }, [leagueId]);

  const handleSend = async () => {
    if (!leagueId || !messageText.trim() || sending) return;

    setSending(true);
    try {
      await sendLeagueMessage(leagueId, messageText);
      setMessageText('');
      // Scroll to bottom after sending
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      Alert.alert('Failed to send message', error?.message ?? 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: Date | Timestamp) => {
    try {
      const d = date instanceof Date ? date : (date as any).toDate ? (date as any).toDate() : new Date();
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  if (!leagueId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={{ color: textColor }}>League not found.</Text>
          <AppButton title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'League Chat',
          headerBackVisible: true,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: t.colors.background }]}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {loading && messages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={tint} />
              <Text style={[styles.loadingText, { color: textColor }]}>Loading messages...</Text>
            </View>
          ) : (
            <>
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: t.colors.mutedText }]}>
                      No messages yet. Be the first to say something!
                    </Text>
                  </View>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.userId === uid;
                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.messageRow,
                          isOwn ? styles.messageRowOwn : styles.messageRowOther,
                        ]}
                      >
                        <View
                          style={[
                            styles.messageBubble,
                            {
                              backgroundColor: isOwn ? tint : cardBg,
                              borderColor: isOwn ? tint : borderColor,
                              borderWidth: isOwn ? 0 : 2,
                            },
                          ]}
                        >
                          {!isOwn && (
                            <Text
                              style={[
                                styles.messageSender,
                                { color: isOwn ? '#FFFFFF' : tint },
                              ]}
                            >
                              {msg.displayName}
                              {msg.username && ` (@${msg.username})`}
                            </Text>
                          )}
                          <Text
                            style={[
                              styles.messageText,
                              { color: isOwn ? '#FFFFFF' : textColor },
                            ]}
                          >
                            {msg.text}
                          </Text>
                          <Text
                            style={[
                              styles.messageTime,
                              { color: isOwn ? 'rgba(255,255,255,0.7)' : t.colors.mutedText },
                            ]}
                          >
                            {formatTime(msg.createdAt)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: cardBg,
                    borderTopColor: borderColor,
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F2F2F7',
                      color: textColor,
                      borderColor,
                    },
                  ]}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Type a message..."
                  placeholderTextColor={t.colors.mutedText}
                  multiline
                  maxLength={500}
                  editable={!sending}
                />
                <AppButton
                  title={sending ? 'Sending...' : 'Send'}
                  onPress={handleSend}
                  disabled={!messageText.trim() || sending}
                  style={{ minWidth: 80 }}
                />
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 20,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    gap: 4,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 2,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    fontSize: 15,
  },
});
