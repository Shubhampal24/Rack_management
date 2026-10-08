import * as React from "react"
import { useLocation } from "react-router-dom"
import { Search, Bell, Menu, Sun, Moon, LogOut, UserPlus } from "lucide-react"
import useWarehouseStore from "@/lib/store/useWarehouseStore"
import { useToast } from "@/components/ui/toast"
import { useAuth } from "@/context/AuthContext"
import { authService } from "@/lib/api/apiService"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/input"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const routeLabels = {
  "/":             { title: "Dashboard",       subtitle: "Overview of your warehouse" },
  "/rack-map":     { title: "Rack Map",        subtitle: "Visual warehouse layout" },
  "/inventory":    { title: "Inventory",       subtitle: "Stock levels & status" },
  "/movements":    { title: "Stock Movement",  subtitle: "IN/OUT transaction log" },
  "/materials":    { title: "Material Master", subtitle: "Material catalog management" },
  "/locations":    { title: "Location Master", subtitle: "Location configuration" },
  "/rack-manager": { title: "Rack Manager",    subtitle: "Rack & bay configuration" },
  "/labels":       { title: "Rack Labels",     subtitle: "Print location labels" },
  "/reference":    { title: "Reference",       subtitle: "Safety rules & data dictionary" },
  "/shipment":     { title: "Shipments",       subtitle: "Bulk truck operations" },
}

export function TopBar({ collapsed, setMobileOpen }) {
  const location = useLocation()
  const setCommandOpen = useWarehouseStore(s => s.setCommandOpen)
  const theme = useWarehouseStore(s => s.theme)
  const toggleTheme = useWarehouseStore(s => s.toggleTheme)
  const reorderAlerts = useWarehouseStore(s => (s.inventory ?? []).filter(i => i.status === 'REORDER').length)
  const { toast } = useToast()
  
  const { user, logout } = useAuth()
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [registerOpen, setRegisterOpen] = React.useState(false)
  const [regForm, setRegForm] = React.useState({ userId: '', name: '', role: 'Godown keeper', pin: '' })
  const [regLoading, setRegLoading] = React.useState(false)

  const profileRef = React.useRef(null)
  React.useEffect(() => {
    const handleOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const info = routeLabels[location.pathname] || { title: "HopShop", subtitle: "" }

  const handleRegister = async (e) => {
    e.preventDefault()
    setRegLoading(true)
    try {
      await authService.register(regForm)
      toast({ title: 'User Registered', description: `User ${regForm.userId} created successfully.`, variant: 'success' })
      setRegisterOpen(false)
      setRegForm({ userId: '', name: '', role: 'Godown keeper', pin: '' })
    } catch (err) {
      toast({ title: 'Registration Failed', description: err.response?.data?.error || err.message || 'Error occurred', variant: 'destructive' })
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <header className="shrink-0 z-30 flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 border-b border-border bg-card/90 backdrop-blur-xl w-full">
      <button 
        className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 shrink-0"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} />
      </button>
      <div className="flex-1 min-w-0 hidden sm:block">
        <h1 className="text-base font-semibold text-foreground truncate">{info.title}</h1>
        <p className="text-xs text-muted-foreground">{info.subtitle}</p>
      </div>
      <div className="flex-1 min-w-0 sm:hidden">
        <h1 className="text-sm font-bold text-foreground truncate">{info.title}</h1>
      </div>

      <button
        onClick={() => setCommandOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-2 sm:px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary/50 transition-colors shrink-0"
      >
        <Search size={14} />
        <span className="hidden sm:block">Search...</span>
        <kbd className="hidden sm:block text-xs border border-border rounded px-1.5 py-0.5">Ctrl K</kbd>
      </button>

      <button className="relative rounded-lg border border-border p-2 hover:bg-secondary/50 transition-colors shrink-0">
        <Bell size={16} className="text-muted-foreground" />
        {reorderAlerts > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
            {reorderAlerts}
          </span>
        )}
      </button>

      <button
        onClick={toggleTheme}
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className="rounded-lg border border-border p-2 hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        {theme === "dark" ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-blue-600" />}
      </button>

      {/* User Profile */}
      <div className="relative group shrink-0" ref={profileRef}>
        <div 
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 cursor-pointer p-1 rounded-md hover:bg-secondary/50 transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white shadow-md shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="hidden sm:block pr-2 max-w-[140px]">
            <p className="text-sm font-medium text-foreground leading-tight truncate">{user?.name || 'User'}</p>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">{user?.role || 'Role'}</p>
          </div>
        </div>

        {profileOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover shadow-lg z-50 p-1 text-popover-foreground animate-in fade-in zoom-in-95">
            <div className="px-2 py-2 border-b border-border mb-1">
              <p className="text-xs text-muted-foreground leading-tight">Logged in as</p>
              <p className="text-sm font-medium truncate mt-0.5">{user?.userId}</p>
            </div>
            
            {user?.role === 'Admin' && (
              <button 
                onClick={() => { setProfileOpen(false); setRegisterOpen(true); }}
                className="w-full flex items-center gap-2 text-left px-2 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <UserPlus size={14} /> Register User
              </button>
            )}
            
            <button 
              onClick={logout}
              className="w-full flex items-center gap-2 text-left px-2 py-2 text-sm rounded-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        )}
      </div>

      {/* Register User Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register New User</DialogTitle>
            <DialogDescription>Create a new user and assign their role.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4 px-6 pt-2 pb-4">
            <div className="space-y-1.5">
              <Label>User ID (Login Name) <span className="text-destructive">*</span></Label>
              <Input required value={regForm.userId} onChange={e => setRegForm({...regForm, userId: e.target.value})} placeholder="e.g. USER@123" />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Role <span className="text-destructive">*</span></Label>
              <Select value={regForm.role} onValueChange={v => setRegForm({...regForm, role: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Godown keeper">Godown keeper</SelectItem>
                  <SelectItem value="Purchase dept">Purchase dept</SelectItem>
                  <SelectItem value="Sales dept">Sales dept</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Password (PIN) <span className="text-destructive">*</span></Label>
              <Input required type="text" value={regForm.pin} onChange={e => setRegForm({...regForm, pin: e.target.value})} placeholder="e.g. WM@123" />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={regLoading}>{regLoading ? 'Registering...' : 'Register User'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  )
}
