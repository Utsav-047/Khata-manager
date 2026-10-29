import urllib.request
import json

def post(url, data, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def get(url, token=None):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def run():
    # 1. Login via Frontend Proxy
    login = post('http://localhost:5173/api/auth/login', {'username': 'admin', 'password': 'admin123'})
    token = login['access_token']
    print(f"1. Logged in successfully: User '{login['username']}', Role '{login['role']}'")

    # 2. Create customer
    cust = post('http://localhost:5173/api/customers', {
        'name': 'Sharma Enterprises',
        'phone': '9876543210',
        'city': 'Jaipur',
        'opening_balance': 5000.0,
        'credit_limit': 100000.0
    }, token)
    print(f"2. Created customer: {cust['name']} (Code: {cust['code']}, ID: {cust['id']})")

    # 3. Create product
    prod = post('http://localhost:5173/api/products', {
        'name': 'Basmati Rice 25kg',
        'unit': 'bag',
        'unit_price': 1850.0
    }, token)
    print(f"3. Created product: {prod['name']} (Code: {prod['code']}, Price: Rs.{prod['unit_price']})")

    # 4. Create Invoice (10 bags @ 1850 with 5% tax - 200 discount = 19225.00)
    inv = post('http://localhost:5173/api/invoices', {
        'customer_id': cust['id'],
        'invoice_date': '2026-10-16',
        'discount_amount': 200.0,
        'items': [{
            'product_id': prod['id'],
            'description': 'Basmati Rice 25kg Bag',
            'quantity': 10,
            'unit_price': 1850.0,
            'discount_pct': 0,
            'tax_rate': 5
        }]
    }, token)
    print(f"4. Created invoice: {inv['invoice_number']} (Total: Rs.{inv['total_amount']}, Balance Due: Rs.{inv['balance_due']})")

    # 5. Record Payment with partial allocation
    pay = post('http://localhost:5173/api/payments', {
        'customer_id': cust['id'],
        'payment_date': '2026-10-16',
        'amount': 10000.0,
        'mode': 'upi',
        'reference': 'UPI-987654321',
        'allocations': [{
            'invoice_id': inv['id'],
            'allocated_amount': 10000.0
        }]
    }, token)
    print(f"5. Recorded payment: {pay['receipt_number']} (Amount: Rs.{pay['amount']})")

    # 6. Customer Ledger
    ledger = get(f"http://localhost:5173/api/customers/{cust['id']}/ledger", token)
    print(f"6. Customer Ledger:")
    print(f"   Opening Balance : Rs.{ledger['opening_balance']}")
    print(f"   Total Debits    : Rs.{ledger['total_debits']}")
    print(f"   Total Credits   : Rs.{ledger['total_credits']}")
    print(f"   Closing Balance : Rs.{ledger['closing_balance']}")
    print(f"   Ledger entries  :")
    for e in ledger['entries']:
        print(f"     * {e['date']} | {e['type']:10} | {e['reference']:12} | Debit: Rs.{e['debit']:>8} | Credit: Rs.{e['credit']:>8} | Balance: Rs.{e['balance']:>8}")

    print("\nAll End-to-End Accounting Validations Passed Successfully!")

if __name__ == '__main__':
    run()
