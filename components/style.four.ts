import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // Ensures content sits safely within screen bounds
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Main container inside ScrollView
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 60,
    backgroundColor: '#FFFFFF',
  },

  // Logo section
  logoSection: {
    paddingTop: 20,
    paddingBottom: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    marginBottom: 24,
  },
  // Page title at top
  mainTitle: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 24,
    color: '#000000',
    letterSpacing: 0.5,
  },

  // Input containers for spacing between text boxes
  inputContainer: {
    width: '100%',
    marginBottom: 14,
  },

  // Text inputs (league name / game)
  input: {
    height: 48,
    borderWidth: 2,
    borderColor: '#000000', // Black border
    paddingHorizontal: 14,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },

  // "Create League" button
  button: {
    backgroundColor: '#DC143C', // Red
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#DC143C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#000000', // Black accent border
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },

  // "My Leagues" section heading
  sectionTitle: {
    width: '100%',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 26,
    marginBottom: 8,
    color: '#000000', // Black text
  },

  // Text shown when no leagues exist
  emptyText: {
    width: '100%',
    marginTop: 6,
    textAlign: 'center',
    fontSize: 16,
    color: '#666666',
  },

  // Each league item in the list
  leagueItem: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  leagueName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.3,
  },

  leagueGame: {
    marginTop: 6,
    fontSize: 15,
    color: '#666666',
    fontWeight: '600',
  },
});
