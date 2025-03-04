import { useState, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import io from 'socket.io-client';
import PropTypes from 'prop-types';
import Logo from '../canLogo/logo';
import './UserChat.css';
import SendText from './sendText';
import DisplayText from './displayText';
import init, { encrypt as wasmEncrypt, decrypt as wasmDecrypt } from './../../../aes-wasm/pkg';

// Secret key and nonce for encryption
const secretKey = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const nonce = '000102030405060708090a0b'; 

// Encrypt and decrypt functions from WebAssembly module
const encrypt = async (text) => {
  await init();
  try {
    return  wasmEncrypt(text, secretKey, nonce);
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

const decrypt = async (text) => {
  await init();
  try {
    return wasmDecrypt(text, secretKey, nonce);
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
};

function Chat({ token, activeChat }) {
  const socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token },
  });

  const userId = token ? jwtDecode(token).id : '';
  const targetUserId = activeChat;
  const username = token ? jwtDecode(token).username : '';
  const [messages, setMessages] = useState([]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!userId || !targetUserId) return;

    console.log(`🔄 Fetching messages for chat: User ${userId} ↔ Target ${targetUserId}`);

    // Reset messages when switching chats
    setMessages([]);

    const handleInitMessages = async (messages) => {
      console.log('✅ Received init messages:', messages);

      const decryptedMessages = await Promise.all(
        messages.map(async (message) => ({
          ...message,
          text: await decrypt(message.text),
        }))
      );

      console.log('✅ Decrypted messages:', decryptedMessages);
      markMessagesAsSeen(decryptedMessages);
      setMessages(decryptedMessages);
    };

    const handleChatMessage = async (message) => {
      console.log('📩 Received real-time message:', message);
      const sender = String(message.userId);

      if (activeChat === sender) {
        console.log('👁️👁️ Message seen:', message);
        socket.emit('messageSeen', { userId, targetUserId });
      } else {
        console.log("NOT SEEN 👁️👁️ RecievedMessageId", message.userId, 'Active:', activeChat);
      }

      // Only update messages if they belong to the current chat
      if (
        (message.userId === userId && message.targetUserId === targetUserId) ||
        (message.userId === targetUserId && message.targetUserId === userId)
      ) {
        const decryptedMessage = {
          ...message,
          text: await decrypt(message.text),
        };
        setMessages((prevMessages) => [...prevMessages, decryptedMessage]);
      }
    };

    // Emit ready to fetch messages when opening a chat
    socket.emit('ready', { userId, targetUserId });

    // Listen for real-time messages
    socket.on('init', handleInitMessages);
    socket.on('chat message', handleChatMessage);

    return () => {
      console.log(`🧹 Cleaning up listeners for chat: User ${userId} ↔ Target ${targetUserId}`);
      socket.off('init', handleInitMessages);
      socket.off('chat message', handleChatMessage);
    };
  }, [userId, targetUserId]); // Runs whenever activeChat changes

  useEffect(() => {
    const container = document.querySelector(".messages-container");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const markMessagesAsSeen = (messages) => {
    const unseenMessages = messages.filter((msg) => msg.userId !== userId);
    if (unseenMessages.length > 0) {
      socket.emit('messageSeen', { userId, targetUserId });
      console.log('👀 Marking all messages as seen');
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    try {
      const encryptedText = await encrypt(text);

      // Temporary ID for React rendering and Display decrypted text instantly
      const newMessage = {
        _id: Date.now(),
        text,
        userId,
        targetUserId,
        username,
        createdAt: new Date().toISOString(),
      };

      console.log('Sending message:', newMessage);

      // Emit message to the server
      socket.emit('chat message', { text: encryptedText, userId, targetUserId, username });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Listen for messageSeenUpdate
  socket.on('messageSeenUpdate', ({ userId, targetUserId }) => {
    console.log('👀', targetUserId, 'Message seen by:', userId);
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        return { ...msg, seenStatus: true };
      })
    );
  });

  return (
    <div className="app-container">
      <div className="logo-container">
        <Logo />
      </div>
      <div className="chat-container">
        <div className="messages-container">
          <DisplayText messages={messages} currentUserId={userId} />
          <div ref={messagesEndRef} />
        </div>
        <SendText sendMessage={sendMessage} />
      </div>
    </div>
  );
}

Chat.propTypes = {
  token: PropTypes.string.isRequired,
  activeChat: PropTypes.string.isRequired,
};

export default Chat;