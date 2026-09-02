import { Store, Mail, Phone, MapPin } from 'lucide-react';

interface FooterProps {
  storeName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export function Footer({
  storeName = 'My Store',
  email = '',
  phone = '',
  address = '',
}: FooterProps) {
  return (
    <footer className="bg-card border-t border-border mt-8 sm:mt-12">
      <div className="container px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Brand */}
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2 mb-3 sm:mb-4 justify-center sm:justify-start">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary">
                <Store className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-base sm:text-lg">{storeName}</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Your one-stop shop for quality products at great prices.
            </p>
          </div>

          {/* Contact */}
          <div className="text-center sm:text-left">
            <h4 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">Contact Us</h4>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-muted-foreground">
              <a 
                href={`mailto:${email}`} 
                className="flex items-center gap-2 hover:text-foreground transition-colors justify-center sm:justify-start"
              >
                <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">{email}</span>
              </a>
              <a 
                href={`tel:${phone}`} 
                className="flex items-center gap-2 hover:text-foreground transition-colors justify-center sm:justify-start"
              >
                <Phone className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                {phone}
              </a>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">{address}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="text-center sm:text-left sm:col-span-2 lg:col-span-1">
            <h4 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">We Accept</h4>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center sm:justify-start">
              <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-secondary rounded-lg text-xs sm:text-sm font-medium">
                📱 UPI
              </div>
              <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-secondary rounded-lg text-xs sm:text-sm font-medium">
                PhonePe
              </div>
              <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-secondary rounded-lg text-xs sm:text-sm font-medium">
                Google Pay
              </div>
              <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-secondary rounded-lg text-xs sm:text-sm font-medium">
                Paytm
              </div>
              <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-secondary rounded-lg text-xs sm:text-sm font-medium">
                💳 Card
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-6 sm:mt-8 pt-6 sm:pt-8 text-center text-xs sm:text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {storeName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
