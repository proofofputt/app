import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext.jsx';
import { apiCoachChat, apiListConversations, apiGetConversationHistory } from '@/api.js'; // Keep all imports
import ReactMarkdown from 'react-markdown';
import './Coach.css';

const CoachPage = () => {
  const { playerData } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [rateLimitError, setRateLimitError] = useState('');
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = useCallback(async () => {
    if (!playerData?.player_id) return;
    setIsSidebarLoading(true);
    try {
      const convos = await apiListConversations(playerData.player_id);
      setConversations(convos || []);
      return convos || [];
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      return [];
    } finally {
      setIsSidebarLoading(false);
    }
  }, [playerData?.player_id]);

  useEffect(() => {
    const initialLoad = async () => {
      if (!playerData?.player_id) return;
      setIsLoading(true);
      const convos = await fetchConversations();
      if (convos && convos.length > 0) {
        // Automatically load the most recent conversation
        await handleSelectConversation(convos[0].conversation_id);
      } else {
        // If no conversations exist, show a welcome message.
        setMessages([{
          role: 'model',
          parts: ["Welcome to the AI Coach! Your first analysis will be generated automatically after you log in on a new day and have session data available."]
        }]);
      }
      setIsLoading(false);
    };

    initialLoad();
  }, [playerData?.player_id]);

  useEffect(scrollToBottom, [messages]);

  const handleSelectConversation = async (conversationId) => {
    if (isLoading || currentConversationId === conversationId) return;
    setIsLoading(true);
    setRateLimitError('');
    setCurrentConversationId(conversationId);
    try {
      const history = await apiGetConversationHistory(conversationId);
      setMessages(history);
      setUserMessageCount(history.filter(m => m.role === 'user').length);
    } catch (error) {
      setMessages([{
        role: 'model',
        parts: [`Could not load conversation. ${error.message}`]
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !currentConversationId || userMessageCount >= 5) return;

    const tempUserMessage = { role: 'user', parts: [userInput] };
    setMessages(prev => [...prev, tempUserMessage]);
    setUserMessageCount(prev => prev + 1); // Optimistically increment
    const currentInput = userInput;
    setUserInput('');
    setIsLoading(true);
    setRateLimitError('');

    try {
      const payload = {
        player_id: playerData.player_id,
        message: currentInput,
        conversation_id: currentConversationId,
      };
      const response = await apiCoachChat(payload);

      const botResponse = { role: 'model', parts: [response.response] };
      setMessages(prev => [...prev, botResponse]);

    } catch (err) {
      // Revert optimistic updates
      setMessages(prev => prev.slice(0, -1));
      setUserMessageCount(prev => prev - 1);
      if (err.message.includes("message limit")) {
        setRateLimitError(err.message);
      } else {
        const errorResponse = { role: 'model', parts: [`Sorry, I encountered an error: ${err.message}`] };
        setMessages(prev => [...prev, errorResponse]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="coach-page-layout">
      <div className="conversation-sidebar">
        <div className="sidebar-header">
          <h3>Conversations</h3>
        </div>
        <div className="conversation-list">
          {isSidebarLoading ? (
            <p>Loading...</p>
          ) : conversations.length > 0 ? (
            conversations.map(convo => (
              <div
                key={convo.conversation_id}
                className={`conversation-item ${convo.conversation_id === currentConversationId ? 'selected' : ''}`}
                onClick={() => handleSelectConversation(convo.conversation_id)}
              >
                <span className="conversation-title">{convo.title}</span>
                <span className="conversation-date">
                  {new Date(convo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))
          ) : (
            <div className="no-conversations-message">No conversations yet.</div>
          )}
        </div>
      </div>

      <div className="chat-panel">
        <div className="chat-messages">
          {messages.length === 0 && !isLoading && (
            <div className="empty-chat-message">
              {conversations.length > 0
                ? "Select a conversation to view."
                : "Your first analysis will appear here after you complete a session."
              }
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role === 'model' ? 'bot' : 'user'}`}>
              <div className="message-bubble">
                {/* Ensure msg.parts is an array before mapping */}
                {Array.isArray(msg.parts) && msg.parts.map((part, i) => (
                  <ReactMarkdown key={i}>{typeof part === 'string' ? part : part.text}</ReactMarkdown>
                ))}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message bot">
              <div className="message-bubble typing-indicator"><span></span><span></span><span></span></div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input-area">
          {rateLimitError && <div className="rate-limit-error">{rateLimitError}</div>}
          <form onSubmit={handleSendMessage}>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={
                !currentConversationId ? "Select a conversation to begin." :
                userMessageCount >= 5 ? "Message limit reached for this conversation." :
                "Ask a follow-up question..."
              }
              disabled={isLoading || !currentConversationId || userMessageCount >= 5}
            />
            <button type="submit" disabled={isLoading || !userInput.trim() || !currentConversationId || userMessageCount >= 5}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CoachPage;