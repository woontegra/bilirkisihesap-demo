import ChatButton from './ChatButton';
import ChatWindow from './ChatWindow';
import { useHukukBot } from './useHukukBot';
import './hukukBot.css';

export default function HukukBot() {
  const {
    // Chat state
    isOpen,
    messages,
    loading,
    remainingQuestions,
    needsPackage,
    
    // Popup state
    showPurchasePopup,
    setShowPurchasePopup,
    showBlockedPopup,
    setShowBlockedPopup,
    
    // Session state
    sessions,
    activeSessionId,
    setActiveSessionId,
    isLoadingSessions,
    isLoadingMessages,
    
    // Functions
    sendMessage,
    toggleChat,
    closeChat,
    clearMessages,
    createSession,
    deleteSession,
    renameSession,
  } = useHukukBot();

  return (
    <>
      <ChatButton onClick={toggleChat} isOpen={isOpen} />
      <ChatWindow
        isOpen={isOpen}
        messages={messages}
        loading={loading}
        remainingQuestions={remainingQuestions}
        needsPackage={needsPackage}
        showPurchasePopup={showPurchasePopup}
        onSetShowPurchasePopup={setShowPurchasePopup}
        showBlockedPopup={showBlockedPopup}
        onSetShowBlockedPopup={setShowBlockedPopup}
        
        // Session props
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSetActiveSessionId={setActiveSessionId}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        isLoadingSessions={isLoadingSessions}
        isLoadingMessages={isLoadingMessages}
        
        onClose={closeChat}
        onSendMessage={sendMessage}
        onClearMessages={clearMessages}
      />
    </>
  );
}
