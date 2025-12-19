// js/admin-panel.js
// Admin panel without authentication

class AdminPanel {
    constructor() {
        this.contacts = [];
        this.filteredContacts = [];
        this.currentFilter = 'all';
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.init();
    }
    
    init() {
        this.checkFirebase();
        this.loadContacts();
        this.setupEventListeners();
        this.setupRealTimeUpdates();
        this.updateStats();
    }
    
    checkFirebase() {
        if (!window.firebaseDb) {
            console.error('Firebase not initialized');
            this.showError('Firebase database not loaded. Please check your connection.');
            return false;
        }
        return true;
    }
    
    async loadContacts() {
        if (!this.checkFirebase()) return;
        
        try {
            this.showLoading();
            
            // Get contacts from Firestore
            const snapshot = await firebaseDb.collection('contacts')
                .orderBy('timestamp', 'desc')
                .get();
            
            this.contacts = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.contacts.push({
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
                });
            });
            
            this.renderContacts();
            this.updateStats();
            
        } catch (error) {
            console.error('Error loading contacts:', error);
            this.showError('Failed to load contacts: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    setupRealTimeUpdates() {
        if (!this.checkFirebase()) return;
        
        // Real-time updates for new contacts
        firebaseDb.collection('contacts')
            .orderBy('timestamp', 'desc')
            .onSnapshot((snapshot) => {
                let hasChanges = false;
                
                snapshot.docChanges().forEach((change) => {
                    hasChanges = true;
                    
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        const newContact = {
                            id: change.doc.id,
                            ...data,
                            timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
                        };
                        
                        // Check if contact already exists
                        const exists = this.contacts.some(c => c.id === newContact.id);
                        if (!exists) {
                            this.contacts.unshift(newContact);
                            this.addContactToTable(newContact);
                            this.updateStats();
                            this.showNewContactNotification(newContact);
                        }
                    }
                    
                    if (change.type === 'modified') {
                        const index = this.contacts.findIndex(c => c.id === change.doc.id);
                        if (index !== -1) {
                            const data = change.doc.data();
                            this.contacts[index] = {
                                id: change.doc.id,
                                ...data,
                                timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
                            };
                            this.renderContacts();
                        }
                    }
                    
                    if (change.type === 'removed') {
                        this.contacts = this.contacts.filter(c => c.id !== change.doc.id);
                        this.renderContacts();
                        this.updateStats();
                    }
                });
                
                if (hasChanges) {
                    console.log('Database updated in real-time');
                }
            }, (error) => {
                console.error('Real-time update error:', error);
            });
    }
    
    renderContacts() {
        const tableBody = document.getElementById('contactsTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        // Filter contacts
        this.filteredContacts = this.contacts.filter(contact => {
            if (this.currentFilter === 'all') return true;
            if (this.currentFilter === 'new') return contact.status === 'new';
            if (this.currentFilter === 'contacted') return contact.status === 'contacted';
            if (this.currentFilter === 'replied') return contact.status === 'replied';
            if (this.currentFilter === 'closed') return contact.status === 'closed';
            return true;
        });
        
        // Calculate pagination
        const totalPages = Math.ceil(this.filteredContacts.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredContacts.slice(startIndex, endIndex);
        
        // Render each contact
        pageData.forEach(contact => {
            const row = this.createContactRow(contact);
            tableBody.appendChild(row);
        });
        
        // Update counter
        const countElement = document.getElementById('contactCount');
        if (countElement) {
            countElement.textContent = `${this.filteredContacts.length} contacts`;
        }
        
        // Update pagination
        this.updatePagination(totalPages);
    }
    
    createContactRow(contact) {
        const row = document.createElement('tr');
        row.dataset.id = contact.id;
        
        // Format date
        const date = contact.timestamp;
        const dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Escape HTML to prevent XSS
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        row.innerHTML = `
            <td>${escapeHtml(contact.name)}</td>
            <td><a href="mailto:${contact.email}">${contact.email}</a></td>
            <td>${escapeHtml(contact.company || '-')}</td>
            <td>${contact.phone || '-'}</td>
            <td>${contact.service || '-'}</td>
            <td>
                ${dateStr}<br>
                <small style="color: #666;">${timeStr}</small>
            </td>
            <td>
                <span class="status-badge status-${contact.status || 'new'}">
                    ${(contact.status || 'new').charAt(0).toUpperCase() + (contact.status || 'new').slice(1)}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-view" onclick="adminPanel.viewContact('${contact.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-edit" onclick="adminPanel.editContact('${contact.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" onclick="adminPanel.deleteContact('${contact.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Mark as read visually
        if (!contact.read) {
            row.classList.add('unread');
            this.markAsRead(contact.id);
        }
        
        return row;
    }
    
    addContactToTable(contact) {
        const tableBody = document.getElementById('contactsTableBody');
        if (!tableBody) return;
        
        const row = this.createContactRow(contact);
        tableBody.insertBefore(row, tableBody.firstChild);
    }
    
    async viewContact(contactId) {
        try {
            const doc = await firebaseDb.collection('contacts').doc(contactId).get();
            if (doc.exists) {
                const data = doc.data();
                const contact = {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
                };
                
                this.showContactModal(contact);
            }
        } catch (error) {
            console.error('Error viewing contact:', error);
            this.showError('Failed to load contact details');
        }
    }
    
    async editContact(contactId) {
        const contact = this.contacts.find(c => c.id === contactId);
        if (!contact) return;
        
        const statuses = ['new', 'contacted', 'replied', 'closed'];
        const newStatus = prompt(
            'Update Status:\n' + statuses.join(', '),
            contact.status || 'new'
        );
        
        if (newStatus && statuses.includes(newStatus)) {
            try {
                await firebaseDb.collection('contacts').doc(contactId).update({
                    status: newStatus,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                this.showNotification('Status updated successfully');
            } catch (error) {
                console.error('Error updating contact:', error);
                this.showError('Failed to update contact');
            }
        }
    }
    
    async deleteContact(contactId) {
        if (!confirm('Are you sure you want to delete this contact?')) {
            return;
        }
        
        try {
            await firebaseDb.collection('contacts').doc(contactId).delete();
            this.showNotification('Contact deleted successfully');
        } catch (error) {
            console.error('Error deleting contact:', error);
            this.showError('Failed to delete contact');
        }
    }
    
    async markAsRead(contactId) {
        try {
            await firebaseDb.collection('contacts').doc(contactId).update({
                read: true
            });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }
    
    updateStats() {
        const stats = {
            total: this.contacts.length,
            new: this.contacts.filter(c => c.status === 'new').length,
            contacted: this.contacts.filter(c => c.status === 'contacted').length,
            replied: this.contacts.filter(c => c.status === 'replied').length,
            closed: this.contacts.filter(c => c.status === 'closed').length,
            today: this.contacts.filter(c => {
                const contactDate = c.timestamp.toDateString();
                const today = new Date().toDateString();
                return contactDate === today;
            }).length
        };
        
        // Update stat cards
        const elements = {
            'statTotal': stats.total,
            'statNew': stats.new,
            'statContacted': stats.contacted,
            'statReplied': stats.replied,
            'statClosed': stats.closed,
            'statToday': stats.today
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }
    
    updatePagination(totalPages) {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;
        
        pagination.innerHTML = '';
        
        if (totalPages > 1) {
            // Previous button
            if (this.currentPage > 1) {
                const prevBtn = document.createElement('button');
                prevBtn.className = 'page-btn';
                prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                prevBtn.onclick = () => {
                    this.currentPage--;
                    this.renderContacts();
                };
                pagination.appendChild(prevBtn);
            }
            
            // Page numbers
            for (let i = 1; i <= totalPages; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === this.currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.onclick = () => {
                    this.currentPage = i;
                    this.renderContacts();
                };
                pagination.appendChild(pageBtn);
            }
            
            // Next button
            if (this.currentPage < totalPages) {
                const nextBtn = document.createElement('button');
                nextBtn.className = 'page-btn';
                nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                nextBtn.onclick = () => {
                    this.currentPage++;
                    this.renderContacts();
                };
                pagination.appendChild(nextBtn);
            }
        }
    }
    
    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.currentPage = 1;
                this.renderContacts();
            });
        });
        
        // Search
        const searchInput = document.getElementById('searchContacts');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                this.filterContacts(searchTerm);
            });
        }
        
        // Export button
        const exportBtn = document.getElementById('exportData');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshData');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadContacts());
        }
    }
    
    filterContacts(searchTerm) {
        if (!searchTerm) {
            this.renderContacts();
            return;
        }
        
        const filtered = this.contacts.filter(contact => {
            return (
                contact.name.toLowerCase().includes(searchTerm) ||
                contact.email.toLowerCase().includes(searchTerm) ||
                (contact.company && contact.company.toLowerCase().includes(searchTerm)) ||
                (contact.phone && contact.phone.includes(searchTerm)) ||
                (contact.service && contact.service.toLowerCase().includes(searchTerm)) ||
                (contact.message && contact.message.toLowerCase().includes(searchTerm))
            );
        });
        
        this.filteredContacts = filtered;
        this.currentPage = 1;
        this.renderContacts();
    }
    
    exportToCSV() {
        if (this.contacts.length === 0) {
            this.showNotification('No data to export', 'error');
            return;
        }
        
        const headers = ['Name', 'Email', 'Company', 'Phone', 'Service', 'Message', 'Status', 'Date'];
        const data = this.contacts.map(contact => [
            contact.name,
            contact.email,
            contact.company || '',
            contact.phone || '',
            contact.service || '',
            contact.message || '',
            contact.status || 'new',
            contact.timestamp.toLocaleDateString()
        ]);
        
        const csvContent = [
            headers.join(','),
            ...data.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ascendia-contacts-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('CSV file downloaded successfully');
    }
    
    showContactModal(contact) {
        const modal = document.createElement('div');
        modal.className = 'contact-modal';
        
        const message = contact.message ? contact.message.replace(/\n/g, '<br>') : 'No message';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Contact Details</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="contact-field">
                        <label>Name:</label>
                        <span>${contact.name}</span>
                    </div>
                    <div class="contact-field">
                        <label>Email:</label>
                        <span><a href="mailto:${contact.email}">${contact.email}</a></span>
                    </div>
                    <div class="contact-field">
                        <label>Company:</label>
                        <span>${contact.company || 'Not provided'}</span>
                    </div>
                    <div class="contact-field">
                        <label>Phone:</label>
                        <span>${contact.phone || 'Not provided'}</span>
                    </div>
                    <div class="contact-field">
                        <label>Service:</label>
                        <span>${contact.service || 'Not specified'}</span>
                    </div>
                    <div class="contact-field">
                        <label>Date:</label>
                        <span>${contact.timestamp.toLocaleString()}</span>
                    </div>
                    <div class="contact-field">
                        <label>Status:</label>
                        <span class="status-badge status-${contact.status || 'new'}">
                            ${contact.status || 'new'}
                        </span>
                    </div>
                    <div class="contact-field full-width">
                        <label>Message:</label>
                        <div class="message-box">${message}</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="adminPanel.editContact('${contact.id}')" class="btn-action btn-edit">
                        Update Status
                    </button>
                    <button onclick="adminPanel.deleteContact('${contact.id}')" class="btn-action btn-delete">
                        Delete Contact
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add modal styles
        this.addModalStyles();
        
        // Close functionality
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    
    addModalStyles() {
        if (!document.getElementById('modal-styles')) {
            const style = document.createElement('style');
            style.id = 'modal-styles';
            style.textContent = `
                .contact-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                
                .modal-content {
                    background: white;
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    border-radius: 10px;
                    overflow: hidden;
                    animation: modalSlideIn 0.3s ease;
                }
                
                @keyframes modalSlideIn {
                    from {
                        transform: translateY(-50px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                .modal-header {
                    background: #0d6efd;
                    color: white;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .modal-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                }
                
                .modal-body {
                    padding: 20px;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                
                .contact-field {
                    display: grid;
                    grid-template-columns: 120px 1fr;
                    gap: 10px;
                    margin-bottom: 15px;
                    align-items: center;
                }
                
                .contact-field.full-width {
                    grid-template-columns: 1fr;
                }
                
                .contact-field label {
                    font-weight: 600;
                    color: #555;
                }
                
                .message-box {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                    margin-top: 5px;
                    line-height: 1.5;
                }
                
                .modal-footer {
                    padding: 15px 20px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                
                .btn-action {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: 500;
                }
                
                .btn-edit {
                    background: #20c997;
                    color: white;
                }
                
                .btn-delete {
                    background: #dc3545;
                    color: white;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    showNewContactNotification(contact) {
        const notification = document.createElement('div');
        notification.className = 'new-contact-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <strong>📩 New Contact Form Submission</strong>
                <p>${contact.name}</p>
                <small>${contact.service || 'No service specified'}</small>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    showLoading() {
        let loader = document.getElementById('loadingOverlay');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loadingOverlay';
            loader.innerHTML = `
                <div class="spinner"></div>
                <p>Loading contacts...</p>
            `;
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255,255,255,0.9);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9998;
            `;
            
            // Add spinner styles
            const spinnerStyle = document.createElement('style');
            spinnerStyle.textContent = `
                .spinner {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #0d6efd;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin-bottom: 15px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(spinnerStyle);
            
            document.body.appendChild(loader);
        }
    }
    
    hideLoading() {
        const loader = document.getElementById('loadingOverlay');
        if (loader) {
            loader.remove();
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc3545;
            color: white;
            padding: 15px 30px;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'success-toast';
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #198754;
            color: white;
            padding: 15px 30px;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize admin panel
window.adminPanel = new AdminPanel();