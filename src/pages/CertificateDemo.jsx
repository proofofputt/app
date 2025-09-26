import React, { useState } from 'react';
import CertificateTemplate from '../components/CertificateTemplate.jsx';
import {
  RARITY_THEMES,
  ACHIEVEMENT_CONFIG,
  CERTIFICATE_SIZES,
  BRANDING,
  createCustomTheme
} from '../config/certificate-config.js';

/**
 * Certificate Template Demo Page
 *
 * Interactive demo for viewing and customizing certificate templates.
 * Use this page to preview all certificate variations and test customizations.
 */

const CertificateDemo = () => {
  const [selectedType, setSelectedType] = useState('consecutive_makes');
  const [selectedRarity, setSelectedRarity] = useState('rare');
  const [selectedSize, setSelectedSize] = useState('standard');
  const [selectedValue, setSelectedValue] = useState(21);
  const [playerName, setPlayerName] = useState('JOHN DOE');

  // Custom theme state
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [customColors, setCustomColors] = useState({
    primary: '#2D5A27',
    secondary: '#D4AF37',
    background: '#F8F9FA',
    border: '#2D5A27',
    text: '#1A1A1A',
    accent: '#4A7C59'
  });

  // Create sample certificate data
  const createSampleData = () => {
    return {
      certificate_id: `demo-cert-${Date.now()}`,
      achievement_type: selectedType,
      achievement_value: selectedValue,
      achieved_at: new Date().toISOString(),
      certificate_issued_at: new Date().toISOString(),
      data_hash: 'a1b2c3d4e5f6789012345678901234567890abcdef123456789012345678901234',
      achievement_data: {
        rarity_tier: selectedRarity,
        description: `Demo ${selectedType} achievement`,
        achievement_subtype: selectedType === 'competition_win' ? 'first_duel_victory' : null
      }
    };
  };

  const samplePlayer = {
    username: playerName.toUpperCase(),
    display_name: playerName
  };

  const theme = useCustomTheme ? createCustomTheme(customColors) : null;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h1 style={{ color: '#2D5A27', marginBottom: '10px' }}>
            🏆 Certificate Template Demo
          </h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Interactive preview of blockchain-verified achievement certificates
          </p>
        </div>

        {/* Controls Panel */}
        <div style={{
          backgroundColor: 'white',
          padding: '25px',
          borderRadius: '12px',
          marginBottom: '30px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>🎨 Customize Certificate</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {/* Achievement Type */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Achievement Type:
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {Object.entries(ACHIEVEMENT_CONFIG).map(([type, config]) => (
                  <option key={type} value={type}>
                    {config.icon} {config.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Rarity */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Rarity:
              </label>
              <select
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {Object.entries(RARITY_THEMES).map(([rarity, theme]) => (
                  <option key={rarity} value={rarity}>
                    {rarity.charAt(0).toUpperCase() + rarity.slice(1)} - {theme.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Size */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Size:
              </label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {Object.entries(CERTIFICATE_SIZES).map(([size, config]) => (
                  <option key={size} value={size}>
                    {size.charAt(0).toUpperCase() + size.slice(1).replace('_', ' ')} ({config.width}×{config.height})
                  </option>
                ))}
              </select>
            </div>

            {/* Achievement Value */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Achievement Value:
              </label>
              <input
                type="number"
                value={selectedValue}
                onChange={(e) => setSelectedValue(parseInt(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                min="1"
                max="100000"
              />
            </div>

            {/* Player Name */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Player Name:
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Enter player name"
                maxLength="24"
              />
            </div>
          </div>

          {/* Custom Theme Toggle */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useCustomTheme}
                onChange={(e) => setUseCustomTheme(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: 'bold', color: '#555' }}>Use Custom Colors</span>
            </label>
          </div>

          {/* Custom Color Pickers */}
          {useCustomTheme && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '15px',
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px'
            }}>
              {Object.entries(customColors).map(([colorKey, colorValue]) => (
                <div key={colorKey}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
                    {colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="color"
                      value={colorValue}
                      onChange={(e) => setCustomColors(prev => ({
                        ...prev,
                        [colorKey]: e.target.value
                      }))}
                      style={{ width: '40px', height: '30px', border: 'none', borderRadius: '4px' }}
                    />
                    <input
                      type="text"
                      value={colorValue}
                      onChange={(e) => setCustomColors(prev => ({
                        ...prev,
                        [colorKey]: e.target.value
                      }))}
                      style={{
                        flex: 1,
                        padding: '5px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Certificate Preview */}
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h3 style={{ marginBottom: '25px', color: '#333' }}>🖼️ Certificate Preview</h3>

          <div style={{ display: 'inline-block', margin: '0 auto' }}>
            <CertificateTemplate
              certificateData={createSampleData()}
              playerData={samplePlayer}
              customTheme={theme}
              size={selectedSize}
            />
          </div>

          {/* Download/Export Options */}
          <div style={{ marginTop: '25px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '15px', color: '#555' }}>Export Options</h4>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2D5A27',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                onClick={() => alert('PNG export would be implemented here')}
              >
                📷 Export as PNG
              </button>
              <button
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#D4AF37',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                onClick={() => alert('PDF export would be implemented here')}
              >
                📄 Export as PDF
              </button>
              <button
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4A7C59',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                onClick={() => alert('Share link would be generated here')}
              >
                🔗 Generate Share Link
              </button>
            </div>
          </div>
        </div>

        {/* Configuration Info */}
        <div style={{
          marginTop: '30px',
          padding: '25px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>⚙️ Configuration Guide</h3>
          <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
            <p><strong>🎨 Colors & Themes:</strong> Modify colors in <code>src/config/certificate-config.js</code> under <code>RARITY_THEMES</code></p>
            <p><strong>✏️ Text & Branding:</strong> Update company name, taglines, and all text in <code>BRANDING</code> and <code>CERTIFICATE_TEXT</code></p>
            <p><strong>👤 Player Names:</strong> Player usernames are inserted from <code>playerData.username</code> or <code>playerData.display_name</code></p>
            <p><strong>🏆 Achievement Types:</strong> Add or modify achievement categories in <code>ACHIEVEMENT_CONFIG</code></p>
            <p><strong>📏 Sizes:</strong> Certificate dimensions and typography are controlled by <code>CERTIFICATE_SIZES</code></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateDemo;