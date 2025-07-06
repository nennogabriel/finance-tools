import React from 'react';

const InputField = ({ label, value, onChange, name, error, type = 'text', placeholder = '', disabled = false }) => (
    <div>
        <label className="text-sm text-gray-600">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full p-2 border rounded-md ${error ? 'border-red-500' : 'border-gray-300'} disabled:bg-gray-100`}
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
);

export default InputField; 